// @flow
import React from 'react';
import classnames from 'classnames';
import autobind from 'autobind-decorator';

const PAGE_SIZE = 25;
const MAX_VALUE_LENGTH = 100;

type Props = {
  body: Buffer,
  fontSize: number,

  // Optional
  className?: string,
};

@autobind
class JSONViewer extends React.PureComponent<Props> {
  viewer: ?HTMLDivElement;
  largestWidth: ?number;

  setRef (n: HTMLDivElement | null) {
    this.viewer = n;
  }

  setMinWidth () {
    if (!this.viewer) {
      return;
    }

    const td = this.viewer.querySelector('td');
    if (!td) {
      return;
    }

    const width = td.getBoundingClientRect().width;
    if (!this.largestWidth || width > this.largestWidth) {
      this.largestWidth = width;
      td.style.minWidth = `${this.largestWidth}px`;
      td.style.boxSizing = 'border-box';
    }
  }

  render () {
    const {
      body,
      fontSize,
      className
    } = this.props;

    let rows;
    try {
      rows = (
        <JSONViewerObj
          onExpand={this.setMinWidth}
          value={JSON.parse(body.toString())}
          paths={[]}
        />
      );
    } catch (err) {
      rows = <tr>
        <td>Uh Oh!</td>
      </tr>;
    }

    return (
      <div ref={this.setRef} className={classnames(className, 'json-viewer')} style={{fontSize}}>
        <table>
          <tbody>{rows}</tbody>
        </table>
      </div>
    );
  }
}

type Props2 = {
  paths: Array<string>,
  value: any,
  onExpand: Function,
  label?: string | number,
  hide?: boolean
};

type State2 = {
  expanded: boolean,
  hasBeenExpanded: boolean,
  page: number
};

@autobind
class JSONViewerObj extends React.PureComponent<Props2, State2> {
  constructor (props: Props2) {
    super(props);
    const {paths} = props;
    this.state = {
      expanded: paths.length === 0,
      hasBeenExpanded: false,
      page: 0
    };
  }

  getType (value: any) {
    const type = Object.prototype.toString.call(value);
    switch (type) {
      case '[object Boolean]':
        return 'boolean';
      case '[object Object]':
        return 'object';
      case '[object Array]':
        return 'array';
      case '[object Number]':
        return 'number';
      case '[object String]':
        return 'string';
      case '[object Null]':
        return 'null';
      default:
        return 'unknown';
    }
  }

  isCollapsable (obj: any): boolean {
    switch (this.getType(obj)) {
      case 'string':
        return obj.length > MAX_VALUE_LENGTH;
      case 'array':
        return obj.length > 0;
      case 'object':
        return Object.keys(obj).length > 0;
      default:
        return false;
    }
  }

  getValue (obj: any, collapsed: boolean) {
    let n;
    let comment;
    let abbr;
    let hasChildren = false;

    if (Array.isArray(obj)) {
      hasChildren = true;
      n = obj.length;
      comment = n > 0 ? `// ${n} item${n === 1 ? '' : 's'}` : '';
      abbr = collapsed && n > 0 ? `[…]` : '[]';
    } else if (obj && typeof obj === 'object') {
      hasChildren = true;
      n = Object.keys(obj).length;
      comment = n > 0 ? `// ${n} key${n === 1 ? '' : 's'}` : '';
      abbr = collapsed && n > 0 ? `{…}` : '{}';
    }

    if (hasChildren) {
      if (n === 0) {
        return abbr;
      }

      if (collapsed) {
        return (
          <td>
            {abbr} <span className="json-viewer__type-comment">{comment}</span>
          </td>
        );
      } else {
        return null;
      }
    }

    const strObj: string = `${obj}`;
    let displayValue = strObj;

    let collapsable = strObj.length > MAX_VALUE_LENGTH;
    if (collapsable && collapsed) {
      const halfOfMax = Math.floor(MAX_VALUE_LENGTH / 2) - 5;
      const start = strObj.slice(0, halfOfMax);
      const end = strObj.slice(strObj.length - halfOfMax);
      displayValue = `${start}…${end}`;
    }

    return (
      <td className={`json-viewer__value json-viewer__type-${this.getType(obj)}`}>
        {displayValue}
      </td>
    );
  }

  componentDidUpdate () {
    this.props.onExpand();
  }

  handleClickKey () {
    this.setState(state => ({
      expanded: !state.expanded,
      hasBeenExpanded: true
    }));
  }

  handleNextPage () {
    this.setState(({page}) => ({page: page + 1}));
  }

  render () {
    const {label, value, paths, hide, onExpand} = this.props;
    const {expanded, hasBeenExpanded, page} = this.state;

    const collapsable = this.isCollapsable(value);
    const collapsed = !expanded;
    const indentStyles = {paddingLeft: `${(paths.length - 1) * 1.3}em`};
    const nextIndentStyles = {paddingLeft: `${(paths.length) * 1.3}em`};

    const rowClasses = classnames({
      'hide': hide,
      'json-viewer__row': true,
      'json-viewer__row--collapsable': collapsable,
      'json-viewer__row--collapsed': collapsed
    });

    const rows = [];
    if (Array.isArray(value)) {
      if (label !== undefined) {
        rows.push((
          <tr key={paths.join('')} className={rowClasses}>
            <td style={indentStyles}
                className="json-viewer__key-container"
                onClick={collapsable ? this.handleClickKey : null}>
              <span className="json-viewer__icon"></span>
              <span className="json-viewer__key json-viewer__key--array">{label}</span>
            </td>
            {this.getValue(value, collapsed)}
          </tr>
        ));
      }

      if (!collapsed || hasBeenExpanded) {
        const maxItem = page >= 0 ? PAGE_SIZE * (page + 1) : Infinity;
        for (let key = 0; key < value.length && key < maxItem; key++) {
          const newPaths = [...paths, `[${key}]`];
          rows.push((
            <JSONViewerObj
              hide={hide || collapsed}
              key={key}
              label={key}
              onExpand={onExpand}
              value={value[key]}
              paths={newPaths}
            />
          ));
        }

        if (value.length > maxItem) {
          const nextBatch = Math.min(value.length - maxItem, PAGE_SIZE);
          rows.push(
            <tr key="next">
              <td style={nextIndentStyles} className="json-viewer__key-container">
                <span className="json-viewer__icon"></span>
                <span className="json-viewer__key json-viewer__key--array">
                  {maxItem}…{value.length - 1}
                </span>
              </td>
              <td className="json-viewer__value json-viewer__value--next-page">
                <button onClick={this.handleNextPage}>
                  Show {nextBatch === PAGE_SIZE ? `${nextBatch} More` : 'Remaining'}
                </button>
              </td>
            </tr>
          );
        }
      }
    } else if (value && typeof value === 'object') {
      if (label !== undefined) {
        rows.push((
          <tr key={paths.join('')} className={rowClasses}>
            <td style={indentStyles}
                className="json-viewer__key-container"
                onClick={collapsable ? this.handleClickKey : null}>
              <span className="json-viewer__icon"></span>
              <span className="json-viewer__key json-viewer__key--array">
              {label}
            </span>
            </td>
            {this.getValue(value, collapsed)}
          </tr>
        ));
      }

      if (!collapsed || hasBeenExpanded) {
        for (let key of Object.keys(value)) {
          const newPaths = [...paths, `.${key}`];
          rows.push((
            <JSONViewerObj
              hide={hide || collapsed}
              key={key}
              label={key}
              onExpand={onExpand}
              value={value[key]}
              paths={newPaths}
            />
          ));
        }
      }
    } else {
      rows.push((
        <tr key={paths.join('')} className={rowClasses}>
          <td style={indentStyles}
              className="json-viewer__key-container"
              onClick={collapsable ? this.handleClickKey : null}>
            <span className="json-viewer__icon"></span>
            {paths.length > 0 ? (
              <span className="json-viewer__key json-viewer__key--array">
                {label}
              </span>
            ) : null}
          </td>
          {this.getValue(value, collapsed)}
        </tr>
      ));
    }

    return rows;
  }
}

export default JSONViewer;
