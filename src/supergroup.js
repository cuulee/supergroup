'use strict';
import _ from 'lodash';
import assert from 'assert';

/** 
 * @Author: [Sigfried Gold](http://sigfried.org) 
 * @License: [MIT](http://sigfried.mit-license.org/) 
 * @Version: 2.0.0
 */
; // jshint -W053

// @class SGNode
// @description Supergroups and SGNodeLists are composed of SGNodes which are
// objects of any sort representing group values.
export class SGNode {
  constructor(val) { // changed class name from Value to SGNode, havent fixed all the code yet
    this.val = val;
    this._hasChildren = false;
  }
  get children() {
    return this._hasChildren && this._children;
  }
  set children(sg) {
    //console.log(`in set children with a ${sg.constructor}`);
    if (! (sg instanceof SGNodeList))
      throw new Error("SGNode children can only be Supergroups");
    //console.log("set children worked this time");
    this._children = sg;
    this._hasChildren = true;
  }
  toString() {
    return this.val.toString();
  }
  get records() {
    return Array.from(this.recsMap.values());
  }
  valueOf() {
    return this.val.valueOf()
  }
  dimPath(opts) {
    opts = delimOpts(opts);
    opts.dimName = true;
    return this.namePath(opts);
  }
  namePath(opts) {
    opts = delimOpts(opts);
    var path = this.pedigree(opts);
    if (opts.dimName) path = path.map(d=>d.dim);
        //_.pluck(path, 'dim');
    if (opts.asArray) return path;
    return path.join(opts.delim);
    /*
    var delim = opts.delim || '/';
    return (this.parent ? 
        this.parent.namePath(_.extend({},opts,{notLeaf:true})) : '') +
      ((opts.noRoot && this.depth===0) ? '' : 
        (this + (opts.notLeaf ? delim : ''))
       )
    */
  }
  pedigree(opts) {
    opts = opts || {};
    var path = [];
    if (!opts.notThis) path.push(this);
    var ptr = this;
    while ((ptr.depth > 0 && (ptr = ptr.parentNode))) {
      path.unshift(ptr);
    }
    if (opts.noRoot) path.shift();
    if (opts.backwards || this.backwards) path.reverse(); //kludgy?
    return path;
    // CHANGING -- HOPE THIS DOESN'T BREAK STUFF (pedigree isn't
    // documented yet)
    if (!opts.asNodes) return path.map(d=>d.val);
    return path;
  }
  path(opts) {
    return this.pedigree(opts);
  }
  //SGNode.prototype.extendGroupBy = // backward compatibility
  /*
  addLevel(dim, opts) {
    opts = opts || {};
    debugger;
    _.each(this.leafNodes() || [this], function(d) {
      opts.parentNode = d;
      if (!('in' in d)) { // d.in means it's part of a diffList
        d.children = new Supergroup(d.records, dim, opts);
      } else { // allows adding levels to diffLists. haven't used for a long time
        if (d['in'] === "both") {
          d.children = diffList(d.from, d.to, dim, opts);
        } else {
          d.children = new Supergroup(d.records, dim, opts);
          _.each(d.children, function(c) {
            c['in'] = d['in'];
            c[d['in']] = d[d['in']];
          });
        }
      }
      d.children.parentNode = d; // NOT TESTED, NOT USED, PROBABLY WRONG!!!
    });
  } */
  _descendants(opts) {
    // should descendants include self? yes for now

    // (old) these two lines fix a treelike bug, hope they don't do harm
    //this.children = this.children || [];

    let nodeList = this._hasChildren && 
                        _.flatten([d].concat(
                          this.children.map(d => d._descendants())), true) || 
                        [this];
    return nodeList;
  }
  descendants(opts) {
    return new SGNodeList(this._descendants(opts));
  }
  _leafNodes(level) {
    //console.log(`this is SGNode: ${this instanceof SGNode}, this: ${this}`);
    // until commit 31278a35b91a8f4bd4ddc4376c840fb14d2723f9
    // supported level param, to only go down so many levels
    // not supporting that any more. wasn't using it

    let nodeList = this._hasChildren && 
                        _.flatten(this.children.map(d => d._leafNodes()), true) || 
                        [this];
    return nodeList;
  }
  leafNodes(opts) {
    return new SGNodeList(this._leafNodes(opts));
  }
  /*
  addRecordsAsChildrenToLeafNodes(truncateEmpty) {
    function fixLeaf(node) {
      node.children = node.records;
      _.each(node.children, function(rec) {
        rec.parentNode = node;
        rec.depth = node.depth + 1;
        for(var method in SGNode.prototype) {
          Object.defineProperty(rec, method, {
            value: SGNode.prototype[method]
          });
        }
      });
    }
    if (typeof truncateEmpty === "undefined")
      truncateEmpty = true;
    if (truncateEmpty) {
      var self = this;
      self.descendants().forEach(function(node) {
        if (self.parentNode && self.parentNode.children.length === 1) {
          fixLeaf(node);
        }
      });
    } else {
      _.each(this.leafNodes(), function(node) {
        fixLeaf(node);
      });
    }
    return this;
  }
  */
  lookup(key) {
    return this.children && this.children.lookup(key) ||
           key === this.valueOf() && this;
  }
  OLDlookup(query) {
    if (Array.isArray(query)) {
      if (this.valueOf() == query[0]) { // allow string/num comparison to succeed?
        query = query.slice(1);
        if (query.length === 0)
          return this;
      }
    } else if (typeof query === "string") {
      if (this.valueOf() == query) {
        return this;
      }
    } else {
      throw new Error("invalid param: " + query);
    }
    if (!this.children)
      throw new Error("can only call lookup on SGNodes with kids");
    return this.children.lookup(query);
  }
  pct() {
    return this.records.length / this.parentList.records.length;
  }
  previous() {
    if (this.parentList) {
      // could store pos on each value, but not doing that now
      var pos = this.parentList.indexOf(this);
      if (pos > 0) {
        return this.parentList[pos - 1];
      }
    }
  }
  aggregate(func, field) {
    if (typeof field === "function")
      return func(this.records.map(field));
    return func(this.records.map(d=>d[field]));
  }
  /* didn't make this yet, just copied from above
  SGNode.prototype.descendants(level) {
    var ret = [this];
    if (level !== 0 && this[childProp] && (!level || this.depth < level))
      ret = _.flatten(_.map(this[childProp], function(c) {
        return c.leafNodes(level);
      }), true);
    return makeList(ret);
  };
  */
}
/**
 * An ArrayMap is a redundant structure: elements are stored in a 
 * public-facing array and also in a private Map. The Map allows
 * elements to be retrieved by key. By default the object appears
 * as an array of objects.
 * REVISION: an optional key function associates a key with an element.
 * You can also associate each element with an index number which is
 * not necessarily its position in the current array (usually it will
 * be its position in some other (parent) array).
 * With a key you can retrieve its element and vice versa. Also you
 * can retrieve an index for an element or key.
 * @param {Object[]} arr Array of anything
 * @param {function} [keyfunc] generates an object to key on by being called
 *                             with parameters (obj, i)
 */
export class ArrayMap extends Array {
  constructor(arr = [], keyFunc) {
    super(...arr);
    this._keyMap = new Map();    // map from key to index
    this._keyFunc = keyFunc;
    this.forEach((element,i) => {
      let key = keyFunc && keyFunc(element) || 
                (typeof element.val !== "undefined") && element.val ||
                i;
      this._keyMap.set(key, i);
    })
  }
  lookup(key) {
    return this[this._keyMap.get(key)];
  }
  has(key) {
    return this._keyMap.has(key);
  }
  keys() {
    return Array.from(this.keyIterator());
  }
  keyIterator() {
    return this._keyMap.keys();
  }
}

/** 
 * @param {int[]} [indices] List of indexes into rawArray
 * @param {Object[]} rawArray Array or another RecsMap
 */
export class RecsMap extends Array {
  constructor(rawArray, indices) {
    super( ...(indices && indices.map(i=>rawArray[i]) || rawArray));
    this.indices = indices;
    this.rawArray = rawArray;
    if (rawArray instanceof RecsMap) {
      // this.arrayLookupFunc...
    } else if (Array.isArray(rawArray)) {
    }
  }
  subset(indices) {
    return new RecsMap(this.rawArray, indices);
  }
  filter(filterFunc) {
    let indices = [];
    let recs = this.filter((d,i) => {
      let include = filterFunc(d);
      if (include) {
        indices.push(this.indices[i]);
      }
    });
    return this.subset(indices);
  }
}
export class SGNodeList extends ArrayMap {
  rawNodes() {
    //console.log(`this.length: ${this.length}, this.keyMap: ${!!this.keyMap}, this.keyMap.keys().length: ${this.keyMap.keys().length}`);
    return this.keys();
    //return this.keyMap(String);
  };
  rawValues() {
    return this.rawNodes();
  }
  /** lookup a value in a list, or, if query is an array
   *  it is interpreted as a path down the group hierarchy */
  OLDlookup(query) { // THIS BELONGS ON SUPERGROUP, NOT HERE
    // fix to take advantage of es6 Map
    if (Array.isArray(query)) {
      // if group has children, can search down the tree
      var values = query.slice(0);
      var list = this;
      var ret;
      while(values.length) {
        ret = list.singleLookup(values.shift());
        list = ret.children;
      }
      return ret;
    } else {
      return this.singleLookup(query);
    }
  };

  OLDgetLookupMap() {
    var self = this;
    if (! ('lookupMap' in self)) {
      self.lookupMap = {};
      self.forEach(function(d) {
        if (d in self.lookupMap)
          console.warn('multiple occurrence of ' + d + 
            ' in list. Lookup will only get the last');
        self.lookupMap[d] = d;
      });
    }
    return self.lookupMap;
  };
  singleLookup(query) {
    return this.getLookupMap()[query];
  };

  // lookup more than one thing at a time
  lookupMany(query) {
    let many = query.map(d => list.singleLookup(d)).filter(d=>typeof d === "undefined");
    //let many = _.chain(query).map(d => list.singleLookup(d)).compact().value();
    return new SGNodeList(many);
    //return many;
    //return addSupergroupMethods(many);
  };
  namePaths(opts) {
    //console.log(`this: ${this}, this[0]: ${this[0]}, this[0] is SGNode: ${this[0] instanceof SGNode}`);
    return this.map(d => d.namePath(opts));
  };
  // apply a function to the records of each group
  // 
  aggregates(func, field, ret) {
    var results = _.map(this, function(val) {
      return val.aggregate(func, field);
    });
    if (ret === 'dict')
      return _.object(this, results);
    return results;
  };

  d3NestEntries() {
    return _.map(this, val => {
      if ('children' in val)
        return {key: val.toString(), values: val.children.d3NestEntries()};
      return {key: val.toString(), values: val.records};
    });
  };
  d3NestMap() {
    return _.chain(this).map(
      function(val) {
        if (val.children)
          return [val+'', val.children.d3NestMap()];
        return [val+'', val.records];
      }).object().value();
  }
  filterSet() {
    return new FilterSet(this);
  }
}

/** 
 * ### [http://sigfried.github.io/supergroup/ -- Tutorial and demo]
 * ### [http://www.toptal.com/javascript/ultimate-in-memory-data-collection-manipulation-with-supergroup-js](Article)
 *
 * usage examples at [http://sigfried.github.io/blog/supergroup](http://sigfried.github.io/blog/supergroup)
 *
 * Avaailable as _.supergroup, Underscore mixin
 * ### Class of grouped records masquerading as an array
 * A `Supergroup` object is an array of `SGNode` objects made by grouping
 * an array of json objects by some set of properties or functions performed
 * on those objects. Each `SGNode` represents a single group. Think of it as
 * a SQL group by:
 *
 *     SELECT state, zipcode, count(*)
 *     FROM addresses
 *     GROUP BY state, zipcode
 *
 * In Supergroup parlance: 'state' and 'zipcode' are _dimensions_; states 
 * ('Alabama', 'Alaska') and zipcodes (50032, 20002) are _values_, or, 
 * rather, value _keys_; and `count(*)` is an aggregation performed on the
 * group. In regular SQL the underlying records represented in a group are
 * not available, with Supergroup they are. So a `SGNode` has a `key` which
 * is the text or number or any javascript object used to form the group.
 * In a group of states, the _key_ of each value would be a `string`, for
 * zipdcodes it could be a `number`. (In previous versions of Supergroup,
 * these were `String` and `Number` objects, but now they are `string` 
 * literals or anything else returnable by a grouping function.)
 *
 * `SGNode` objects have a `key`, and `valueobj.valueOf()` will return that
 * key, and `valueobj.toString()` will return the results of the default
 * toString method on that key. `valueobj.records` is an array of the original
 * javascript objects included in the group represented by the key. And 
 * `valueobj.indexes` is an array of the positions of those records in the
 * original array.
 *
 * - #### Supergroup extends `Array`
 *   - `Array` values are `SGNodes`
 *   - properties:
 *     - map: keys are the keys used to group SGNodes, values are SGNodes
 *     - recsMap:   keys are index into original records array, values are orig records
 *   - methods:
 *     - rawNodes: returns keys from map
 *
 * - SGNodes
 *     - depth:     same as the depth of its parentList (supergroup)
 *     - children:  array of child SGNodes collected in a supergroup (whose
 *                  depth is one greater than the depth of this SGNode)
 *
 * Inherits
 *  - from `ArrayMap`
 *    - Acting like an array of Nodes
 *    - `keys()`: an array of Node keys
 *    - `keyIterator()`: iterator over Node keys
 *  - from `SGNodeList`
 *    - `rawNodes()`
 *    - `rawValues()`
 *    - lookup(key)`
 *    - `getLookupMap()`
 *    - `singleLookup(key)`
 *    - `lookupMany(key)`
 *    - `namePaths(opts)`
 *    - `aggregates(func, field, ret)`
 *    - `d3NestEntries()`
 *    - `d3NestMap()`
 *    - `filterSet()`
 */
export class Supergroup extends SGNodeList {

 /** 
  * Constructor groups records and builds tree structure
  * @exported class supergroup.group(recs, dim, opts)
  * @param {Object[]} recs array of objects, raw data
  * @param {string[]} dims property names to be used for grouping the raw objects 
  * @param {function[]} dims functions on raw objects that return any kind of 
  *                          object to be used for grouping. property names and
  *                          functions can be mixed in dims array. For single-level
  *                          grouping, a single property name or function can be 
  *                          used instead of an array.
  * @param {string[]} [opts.dimNames] array (or single value) of dim names of 
  *                                   same length as dims. Property name dims
  *                                   are used as dimName by default.
  * @param {Object} [opts] options for configuring supergroup behavior. opts are
  *                        forwarded to SGNode constructors and subgroup constructors.
  * @param {Object[]} [opts.excludeNodes] to exlude specific group values
  * @param {function} [opts.preListRecsHook] run recs through this function before continuing processing __currently unused__
  * @param {function} [opts.truncateBranchOnEmptyVal] 
  * @return {Array of SGNodes} enhanced with all the List methods
  */
  constructor({ parentNode=null,
                recs = [], 
                dims=[], dimNames=[], indices,
                opts={} // get rid of opts
              } = {}) {
    indices = indices || _.range(recs.length);
    Supergroup.processOpts(opts);
    parentNode = parentNode || Supergroup.makeRoot('root', -1, recs);
    if (!parentNode) console.error("what's up?");

    if (!Array.isArray(dims)) dims = [dims];
    dims = _.clone(dims);
    let dim = dims.shift();
    dimNames = _.clone( opts.dimName && [opts.dimName] ||
                        opts.dimNames || dimNames);
    let dimName = dimNames.shift();
    let depth = parentNode.depth + 1;
    //console.log(`depth: ${depth}, dims: ${dims}, dim: ${dim}`);
    let dimFunc;
    if (_.isFunction(dim)) {
      dimFunc = dim;
      dimName = dimName || dim.toString();
    } else {
      dimFunc = (d) => d[dim];
      dimName = dimName || dim.toString();
    }

    let groupsMap = new Map();
    let recsMap = parentNode.recsMap;
    recsMap.forEach( (rec,i) => {
      let key = dimFunc(rec);      // this is the key for grouping!
      let val;
      if (!groupsMap.has(key)) {
        if (opts.excludeNodes) {
          if (_.isArray(opts.excludeNodes) && !_.find(opts.exludeNodes(key))) {
          } else if (opts.excludeNodes instanceof Map && !opt.excludeNodes.has(key)) {
          }
        } else {
          val = new SGNode(key); // val.val = key
          val.dim = dimName;
          val.depth = depth;
          val.parentNode = parentNode;
          val.indices = [];
          groupsMap.set(key, val); // save the val in the keyed map
        }
      } else {
        val = groupsMap.get(key);
      }
      val.indices.push(indices[i]);
      //val.recsMap.set(i, rec); // each val gets records and index where
                               // record is in the original array
    });
    // ArrayMap.constructor(arr = [], keyFunc, indices) 
    super(Array.from(groupsMap.values()), d=>d.val);
    this.parentNode = parentNode;
    this.recsMap = recsMap;
    this.parentNode.children = this;
    this.root = this.parentNode.root;

    this.dims = dims;
    this.dimNames = dimNames;
    this.dim = dim;
    this.dimName = dimName;
    this.depth = depth;
    this.dimFunc = dimFunc;
    this.forEach( (val) => {
      val.parentList = this;
      val.root = this.root;
      val.recsMap = this.recsMap.subset(val.indices);
      if (dims.length) {
        //console.log(`ADDING CHILDREN to ${val}`);
        /* Supergroup.constructor({ parentNode=null, recs = [], dims=[], 
        *                           dimNames=[], opts={} } = {}) */
        val.children = new Supergroup({parentNode:val, recs:val.recsMap,
                                      dims:_.clone(dims), 
                                      dimNames:_.clone(dimNames), opts});
      }
    });
  }
  static processOpts(opts) {
    if (opts.multiValuedGroup || opts.multiValuedGroups) {
      throw new Error("multiValuedGroup not implemented in es6 version yet");
    }
    if (opts.preListRecsHook) {
      throw new Error("preListRecsHook not re-implemented yet");
      recs = opts.preListRecsHook ? opts.preListRecsHook(recs) : recs;
    }
    if (opts.truncateBranchOnEmptyVal) { // can't remember when this is used
      throw new Error("truncateBranchOnEmptyVal not re-implemented yet");
      recs = recs.filter(r => !_.isEmpty(r[dim]) || (_.isNumber(r[dim]) && isFinite(r[dim])));
    }
  }

  /** There are time when you want to give your supergroup tree an explicit
   *  root, like when creating hierarchies in D3. In that case call supergroup
   *  like:
   *
   *      let root = makeRoot('Tree Top', 0, recs), 
   *      let sg = new Supergroup({parent=root, dims=['state','zipcode']});
   *
   *  Otherwise Supergroup will make its own fake root with depth -1 instead
   *  of depth 0;
   */
  static makeRoot(name, depth, recs, dimName) {
    name = name || "root";
    dimName = dimName || name;
    let root = new SGNode(name)
    root.dim = dimName;
    root.depth = depth
    root.root = root;
    root.recsMap = new RecsMap(recs);
    return root;
  }
  /** lookup a value in a list, or, if key is an array
   *  it is interpreted as a path down the group hierarchy */
  lookup(key) {
    // fix to take advantage of es6 Map
    if (Array.isArray(key)) {
      return this.lookupPath(key);
    }
    return super.lookup(key);
  }
  lookupPath(keys) {
    keys = keys.slice(0);
    var sg = this;
    var ret;
    while(keys.length) {
      ret = sg.lookup(keys.shift());
      sg = ret.children;
    }
    return ret;
  }

  // sometimes a root value is needed as the top of a hierarchy
  asRootNode(name, dimName) {
    return this.parentNode;
    /*
    var val = new SGNode(name || 'Root');
    val.dim = dimName || 'root';
    val.depth = 0;
    val.records = this.records;
    val.children= this;
    _.each(val.children, function(d) { d.parentNode = val; });
    _.each(val.descendants(), function(d) { d.depth = d.depth + 1; });
    return val;
    */
  };
  leafNodes() {
    return this.parentNode.leafNodes();
  };
  flattenTree() {
    return this.parentNode.descendants();
    //return flatten(this.map(d => [d].concat(d.descendants()))).filter(d=>d);
  };
  rawNodes() {
    //console.log(`this.length: ${this.length}, this.map: ${!!this.map}, this.map.keys().length: ${this.map.keys().length}`);
    return Array.from(this.keys());
  };
  rawValues() {
    return this.rawNodes();
  }
  filterSet() {
    return new FilterSet(this);
  }
  /*
  addLevel(dim, opts) {
    _.each(this, function(val) {
      val.addLevel(dim, opts);
    });
    return this;
  };
  */
  static wholeListNumeric(groups) {
    var isNumeric = _.every(_.keys(groups), function(k) {
      return   k === null ||
            k === undefined ||
            (!isNaN(Number(k))) ||
            ["null", ".", "undefined"].indexOf(k.toLowerCase()) > -1;
    });
    if (isNumeric) {
      _.each(_.keys(groups), function(k) {
        if (isNaN(k)) {
          delete groups[k];    // getting rid of NULL values in dim list!!
        }
      });
    }
    return isNumeric;
  }
}

/** Summarize records by a dimension
  *
  * @param {list} Records to be summarized
  * @param {numericDim} Dimension to summarize by
  *
  * @memberof supergroup
  */
var aggregate = function(list, numericDim) { 
  if (numericDim) {
    list = _.pluck(list, numericDim);
  }
  return _.reduce(list, function(memo,num){
        memo.sum+=num;
        memo.cnt++;
        memo.avg=memo.sum/memo.cnt; 
        memo.max = Math.max(memo.max, num);
        return memo;
      },{sum:0,cnt:0,max:-Infinity});
}; 
/** Compare groups across two similar root nodes
  *
  * @param {from} ...
  * @param {to} ...
  * @param {dim} ...
  * @param {opts} ...
  *
  * used by treelike and some earlier code
  *
  * @memberof supergroup
  */
var diffList = function(from, to, dim, opts) {
  var fromList = new Supergroup(from.records, dim, opts);
  var toList = new Supergroup(to.records, dim, opts);
  //var list = makeList(sg.compare(fromList, toList, dim));
  var list = compare(fromList, toList, dim);
  list.dim = (opts && opts.dimName) ? opts.dimName : dim;
  return list;
};

/** Compare two groups by a dimension
  *
  * @param {A} ...
  * @param {B} ...
  * @param {dim} ...
  *
  * @memberof supergroup
  */
var compare = function(A, B, dim) {
  var a = _.chain(A).map(function(d) { return d+''; }).value();
  var b = _.chain(B).map(function(d) { return d+''; }).value();
  var comp = {};
  _.each(A, function(d, i) {
    comp[d+''] = {
      name: d+'',
      'in': 'from',
      from: d,
      fromIdx: i,
      dim: dim
    };
  });
  _.each(B, function(d, i) {
    if ((d+'') in comp) {
      var c = comp[d+''];
      c['in'] = "both";
      c.to = d;
      c.toIdx = i;
    } else {
      comp[d+''] = {
        name: d+'',
        'in': 'to',
        to: d,
        toIdx: i,
        dim: dim
      };
    }
  });
  var list = _.chain(comp).values().sort(function(a,b) {
    return (a.fromIdx - b.fromIdx) || (a.toIdx - b.toIdx);
  }).map(function(d) {
    var val = new SGNode(d.name);
    _.extend(val, d);
    val.records = [];
    if ('from' in d)
      val.records = val.records.concat(d.from.records);
    if ('to' in d)
      val.records = val.records.concat(d.to.records);
    return val;

  }).value();
  _.chain(list).map(function(d) {
    d.parentList = list; // NOT TESTED, NOT USED, PROBABLY WRONG
    d.records.parentNode = d; // NOT TESTED, NOT USED, PROBABLY WRONG
  }).value();

  return list;
};

/** Concatenate two SGNodes into a new one (??)
  *
  * @param {from} ...
  * @param {to} ...
  *
  * @memberof supergroup
  */
var compareNode = function(from, to) { // any reason to keep this?
  if (from.dim !== to.dim) {
    throw new Error("not sure what you're trying to do");
  }
  var name = from + ' to ' + to;
  var val = new SGNode(name);
  val.from = from;
  val.to = to;
  val.depth = 0;
  val['in'] = "both";
  val.records = [].concat(from.records,to.records);
  val.records.parentNode = val; // NOT TESTED, NOT USED, PROBABLY WRONG
  val.dim = from.dim;
  return val;
};
function delimOpts(opts) {
  if (typeof opts === "string") opts = {delim: opts};
  opts = opts || {};
  if (!_(opts).has('delim')) opts.delim = '/';
  return opts;
}


var hierarchicalTableToTree = function(data, parentPropchildProp) {
  throw new Error("fix this after getting rid of childProp");
  // does not do the right thing if a value has two parents
  // also, does not yet fix depth numbers
  var parents = new Supergroup(data,[parentProp, childProp]); // 2-level grouping with all parent/child pairs
  var children = parents.leafNodes();
  var topParents = _.filter(parents, function(parent) { 
    var adoptiveParent = children.lookup(parent); // is this parent also a child?
    if (adoptiveParent) { // if so, make it the parent
      //adoptiveParent.children = addSupergroupMethods([]);
      adoptiveParent.children = new SGNodeList([]);
      _.each(parent.children, function(c) { 
        c.parent = adoptiveParent; 
        adoptiveParent.children.push(c)
      }); 
    } else { // if not, this is a top parent
      return parent;
    }
    // if so, make use that child node, move this parent node's children over to it
  });
  //return addSupergroupMethods(topParents);
  return new SGNodeList(topParents);
};

// allows grouping by a field that contains an array of values rather than just a single value
if (_.createAggregator) {
  var multiValuedGroupBy = _.createAggregator(function(result, value, keys) {
    _.each(keys, function(key) {
      if (hasOwnProperty.call(result, key)) {
        result[key].push(value);
      } else {
        result[key] = [value];
      }
    });
  });
} else {
  var multiValuedGroupBy = function() { throw new Error("couldn't install multiValuedGroupBy") };
}
/**
 * Class for managing filter state while leaving Supgergroups immutable
 * as much as possible.
 */
export class FilterSet {
  constructor(listOrNode) {
    this.rootNode = listOrNode.root; // every node and list should point up to 
                                     // the same root, including the root itself
    this.filters = [];
  }
  excludeNodes(nodes) {
    nodes = Array.isArray(ndoes) && nodes || [nodes];
    nodes.forEach( node => 
      this.filters.push(new ExcludeNodeFilter(node))
                 );
  }
  
  addFilter(type, key, filt, ids) {
  }
  selectByNode(val) {
    assert.equal(val.root, this.root); // assume state only on root lists
    this.selectedNodes.push(val);
  }
  selectByFilter(filt) {
    this.selectedNodes.push(val);
  }
  selectedRecs() {
    return _.chain(this.selectedNodes).pluck('records').flatten().value();
  }
}

class Filter {
 /** 
  * abstract Filter class
  */
  constructor(key, recsMap) {
    if (new.target === Filter) {
      throw new TypeError("Cannot construct Filter instances directly");
    }
    this.key = key;
    this.filt = filt;
    this.recsMap = recsMap;
  }
}
class NodeFilter extends Filter {
 /** 
  * @param {SGNodeList} filt SGNodeList whose records should be filtered
  * @param {String} key SGNode value (not necessarily a string), 
  * @param {int[]} ids record ids matched by this filter
  */
  constructor(node, filt, ids) {
    if (new.target === Filter) {
      throw new TypeError("Cannot construct Filter instances directly");
    }
    super(node.key, node.recsMap)
    this.node = node;
    this.filt = filt;
    this.ids = ids;   // records ids matched by this filter
  }
}


/*
var g = function *test(n) {for(let i=0; i<n; i++){ yield i}; return; };

let a,b,c;
[a,b,c]=[{a:1},{a:2},{a:3}]
let w = new WeakSet([a,b,c]);
console.log(w);
a = null;
console.log(w.has(a));
console.log(w.has(b));
console.log(w);
debugger;
*/


_.mixin({
  //supergroup: supergroup.supergroup, 
  supergroup: (recs, dims, ...args) => new Supergroup({recs, dims, ...args}),
  //supergroup: function(d) { console.log('EEK'); debugger; throw new Error("blah");},
  //addSupergroupMethods: supergroup.addSupergroupMethods,
  multiValuedGroupBy: multiValuedGroupBy,
  sgDiffList: diffList,
  sgCompare: compare,
  sgCompareNode: compareNode,
  sgAggregate: aggregate,
  hierarchicalTableToTree: hierarchicalTableToTree,

  // FROM https://gist.github.com/AndreasBriese/1670507
  // Return aritmethic mean of the elements
  // if an iterator function is given, it is applied before
  sum : function(obj, iterator, context) {
    if (!iterator && _.isEmpty(obj)) return 0;
    var result = 0;
    if (!iterator && _.isArray(obj)){
    for(var i=obj.length-1;i>-1;i-=1){
      result += obj[i];
    };
    return result;
    };
    each(obj, function(value, index, list) {
    var computed = iterator ? iterator.call(context, value, index, list) : value;
    result += computed;
    });
    return result;
  },
  mean : function(obj, iterator, context) {
    if (!iterator && _.isEmpty(obj)) return Infinity;
    if (!iterator && _.isArray(obj)) return _.sum(obj)/obj.length;
    if (_.isArray(obj) && !_.isEmpty(obj)) return _.sum(obj, iterator, context)/obj.length;
  },

  // Return median of the elements 
  // if the object element number is odd the median is the 
  // object in the "middle" of a sorted array
  // in case of an even number, the arithmetic mean of the two elements
  // in the middle (in case of characters or strings: obj[n/2-1] ) is returned.
  // if an iterator function is provided, it is applied before
  median : function(obj, iterator, context) {
    if (_.isEmpty(obj)) return Infinity;
    var tmpObj = [];
    if (!iterator && _.isArray(obj)){
      tmpObj = _.clone(obj);
      tmpObj.sort(function(f,s){return f-s;});
    }else{
      _.isArray(obj) && each(obj, function(value, index, list) {
        tmpObj.push(iterator ? iterator.call(context, value, index, list) : value);
        tmpObj.sort();
      });
    };
    return tmpObj.length%2 ? tmpObj[Math.floor(tmpObj.length/2)] : (_.isNumber(tmpObj[tmpObj.length/2-1]) && _.isNumber(tmpObj[tmpObj.length/2])) ? (tmpObj[tmpObj.length/2-1]+tmpObj[tmpObj.length/2]) /2 : tmpObj[tmpObj.length/2-1];
  },
});
export const flatten = list => list.reduce(
      (a, b) => a.concat(Array.isArray(b) ? flatten(b) : b), []
);
export default _;
//export default function() { console.log('hi')};