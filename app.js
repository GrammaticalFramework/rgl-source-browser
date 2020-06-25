/* global Vue axios hljs requestAnimationFrame */

// Path to data
const INDEX_PATH = 'data/index.json'
const SEARCH_INDEX_PATH = 'data/search.json'

const defaultLangs = ['abstract', 'api', 'common', 'prelude']

const app = new Vue({
  el: '#app',
  data: {
    index: null, // loaded from index.jsn
    search_index: null, // loaded from search.json
    lookup: [],
    rgl_commit: null, // sha
    search_term: null, // linked to input
    search_terms: [], // internal, processed
    show: {
      results: false,
      loading: true,
      history: true,
      scope: true,
      code: true
    },
    current: {
      language: null,
      module: null,
      scope: null,
      code: null
    },
    error: {
      scope: null,
      code: null
    },
    history: []
  },
  computed: {
    rgl_commit_short: function () {
      if (!this.rgl_commit) return ''
      else return this.rgl_commit.substr(0, 7)
    },
    cols_history: function () {
      return 2
    },
    cols_scope: function () {
      if (this.show.history) {
        if (this.show.code) return 4
        else return 12 - this.cols_history
      } else {
        if (this.show.code) return 5
        else return 12
      }
    },
    cols_code: function () {
      if (this.show.history) {
        if (this.show.scope) return 6
        else return 12 - this.cols_history
      } else {
        if (this.show.scope) return 7
        else return 12
      }
    },
    history_reversed: function () {
      return this.history.reverse()
    },
    // [ { language: ..., module: ... } ]
    module_results: function () {
      if (!this.index || !this.index.languages) return []
      const ss = this.search_terms
      if (ss.length === 0) {
        return []
      }
      let rs = []
      for (const l in this.index.languages) {
        if (ss.every(s => l.includes(s))) {
          rs = rs.concat(this.index.languages[l].map(m => {
            return {
              language: l,
              module: m
            }
          }))
        } else {
          this.index.languages[l].forEach(m => {
            const ml = m.toLowerCase()
            if (ss.every(s => ml.includes(s))) {
              rs.push({
                language: l,
                module: m
              })
            }
          })
        }
      }
      return rs
    },
    scope_results: function () {
      if (!this.current.scope) return []
      const ss = this.search_terms
      if (ss.length === 0) {
        return []
      }
      return this.current.scope.filter(sc =>
        ss.every(s => sc.ident.toLowerCase().includes(s))
      )
    },
    global_results: function () {
      if (this.search_index && this.search_term && this.search_term.length > 2) {
        const res = find(this.search_index, this.search_term)
        if (res) {
          res.hits.forEach(h => {
            const bits = h.location.split(/[/.:]/)
            h.language = bits[0]
            h.module = bits[1]
            h.lines = bits[3]
          })
        }
        return res
      } else {
        return null
      }
    }
  },
  watch: {
    search_term: function () {
      if (!this.search_term) {
        this.show.results = false
      } else {
        this.search_terms = this.search_term.toLowerCase().split(/ +/).filter(s => s.length > 1)
        this.show.results = true
      }
    },
    'current.code': function (newVal, oldVal) {
      // This is called twice, once when clearing old and again when new is loaded
      if (newVal) {
        Vue.nextTick(this.highlightCode)
      }
    }
  },
  mounted: function () {
    // Load indexes
    Promise.all([
      axios.get(INDEX_PATH)
        .then(resp => {
          this.index = resp.data
          this.rgl_commit = resp.data.commit

          // Build language lookup index
          for (const lang in resp.data.languages) {
            for (const module of resp.data.languages[lang]) {
              if (!this.lookup[module]) this.lookup[module] = []
              this.lookup[module].push(lang)
            }
          }
        }),
      axios.get(SEARCH_INDEX_PATH)
        .then(resp => {
          this.search_index = resp.data
        })
    ]).then(() => {
      this.show.loading = false
      if (window.location.hash) {
        this.loadModuleFromHash(window.location.hash)
      }
    })
  },
  methods: {
    // Called directly by page anchors, pushes onto browser history
    selectModule: function (lang, module, ident = null, lines = null, scrollScope = true) {
      // Push browser history state
      let href = `#!${lang}/${module}`
      if (lines) href += `:${lines}`
      window.history.pushState(
        {
          language: lang,
          module: module,
          ident: ident,
          lines: lines
        }, // state
        null, // title
        href // url
      )
      this.loadModule(lang, module, ident, lines, scrollScope)
    },
    // Called on browser history popstate and page load
    loadModuleFromHash: function (hash) {
      const m = hash.match(/#!(\w+)\/(\w+)(?::(.+))?/)
      if (m) {
        this.loadModule(m[1], m[2], null, m[3] || null)
      }
    },
    // Does work of loading module scope and code
    loadModule: function (lang, module, ident = null, lines = null, scrollScope = true) {
      const addToHistory = () => {
        // Store history of idents/line numbers within module history
        let histItem
        const histItemIx = this.history.findIndex(h => h.language === lang && h.module === module)
        if (histItemIx > -1) {
          histItem = this.history[histItemIx]
          if (lines && histItem.locations.findIndex(l => l.lines === lines) < 0) {
            histItem.locations.push({
              ident: ident,
              lines: lines
            })
            histItem.locations.sort((a, b) => parseInt(a.lines) - parseInt(b.lines))
          }
        } else {
          histItem = {
            language: lang,
            module: module,
            locations: []
          }
          this.history.push(histItem)
          this.history.sort((a, b) => {
            if (a.language === b.language) {
              return a.module < b.module ? 1 : -1
            } else {
              return a.language < b.language ? 1 : -1
            }
          })
        }
      }

      this.show.results = false
      if (lang === this.current.language && module === this.current.module) {
        if (lines) {
          addToHistory()
          Vue.nextTick(() => this.scrollToCodeLine(parseInt(lines)))
        }
        if (ident && scrollScope) {
          Vue.nextTick(() => this.scrollToScopeIdent(ident))
        }
        return
      }
      this.current.scope = null
      this.current.code = null
      this.error.scope = null
      this.error.code = null
      this.show.loading = true
      Promise.all([
        axios.get(`${this.index.tags_path}/${module}.gf-tags`)
          .then(resp => {
            this.current.scope = this.processTags(resp.data)
          })
          .catch(err => {
            this.error.scope = err
            this.current.scope = null
          }),
        axios.get(`${this.index.src_path}/${lang}/${module}.gf`)
          .then(resp => {
            this.current.code = resp.data.replace(/\t/g, '        ') // 8 spaces, default CSS tab-size
          })
          .catch(err => {
            this.error.code = err
            this.current.code = null
          })
      ]).then(() => {
        this.current.language = lang
        this.current.module = module
        addToHistory()
        document.querySelector('title').innerText = `${lang}/${module} - RGL Browser`
        this.show.loading = false

        if (lines) {
          doubleRaf(() => this.scrollToCodeLine(parseInt(lines)))
        }
        if (ident && scrollScope) {
          this.scrollToScopeIdent(ident)
        }
      })
    },
    clearCurrent: function () {
      this.current.language = null
      this.current.module = null
      this.current.scope = null
      this.current.code = null
    },
    processTags: function (raw) {
      const rs = []
      raw.split('\n').forEach(line => {
        if (!line) return
        const s = line.split('\t')
        const r = {
          ident: s[0],
          jtype: null,
          ftype: null,
          language: null,
          module: null,
          lines: null,
          indir: false
        }
        if (s[1] === 'indir') {
          r.indir = true
          r.module = s[4].substring(s[4].lastIndexOf('/') + 1, s[4].lastIndexOf('.'))
          r.language = this.lookupModuleLanguage(r.module)
          r.jtype = '(indir)'
          // if (s[2]) r.jtype += ' ' + s[2]
          // if (s[3]) r.jtype += '/' + s[3]
        } else {
          r.jtype = s[1]
          const bits = s[2].split('/') // [..., ..., 'english', 'AdjectiveEng.gf:43-46']
          r.language = bits[bits.length - 2] // english
          const modline = bits[bits.length - 1]
          r.module = modline.slice(0, modline.indexOf('.')) // AdjectiveEng
          r.lines = modline.indexOf(':') > -1 ? modline.slice(modline.indexOf(':') + 1) : null // 46-53, not always there!
          r.ftype = s[3]
        }
        rs.push(r)
      })
      return rs
    },
    lookupModuleLanguage: function (module) {
      const l = this.lookup[module]
      if (l === undefined || l.length === 0) {
        return null
      } else if (l.length === 1) {
        return l[0]
      } else {
        for (const i in l) {
          if (defaultLangs.includes(l[i])) {
            return l[i]
          }
        }
        return l[0] // no preferred default, just return first
      }
    },
    highlightCode: function () {
      const elem = document.querySelector('#code pre code')
      if (!elem) return
      hljs.highlightBlock(elem)
      if (hljs.lineNumbersBlock) hljs.lineNumbersBlock(elem)
    },
    scrollToScopeIdent: function (ident) {
      const scopeElem = document.querySelector('#scope')
      const identElem = document.querySelector(`#scope [data-ident="${ident}"]`)
      if (!scopeElem || !identElem) return
      scopeElem.scrollTo({
        left: 0,
        top: identElem.offsetTop,
        behavior: 'smooth'
      })
    },
    scrollToCodeLine: function (line) {
      const codeElem = document.querySelector('#code')
      const lineElem = document.querySelector(`#code [data-line-number="${line}"]`)
      if (!codeElem || !lineElem) return
      codeElem.scrollTo({
        left: 0,
        top: lineElem.parentElement.offsetTop,
        behavior: 'smooth'
      })
    },
    focusInput: function (e) {
      e.target.select()
      this.show.results = Boolean(this.search_term)
    },
    codeClick: function (ev) {
      const elem = ev.path[0]
      const text = elem.innerText
      let token
      const tokens = text.trim().split(/\s+/)
      if (tokens.length === 1) {
        // if single token, just use that
        token = tokens[0]
      } else {
        // get char width from first span in code
        const e1 = document.querySelector('#code span.hljs-type')
        const charWidth = e1.getBoundingClientRect().width / e1.innerText.length

        // calculate token under cursor
        const boundaryRegex = /\W/
        const offset = ev.clientX - elem.getBoundingClientRect().x // from left edge of parent container to cursor
        const index = Math.floor(offset / charWidth) // character under cursor
        const tokenStartIndex = searchLast(text.slice(0, index), boundaryRegex)
        const tokenEndIndex = text.slice(index).search(boundaryRegex)
        token = text.slice(
          tokenStartIndex > -1 ? tokenStartIndex + 1 : 0,
          tokenEndIndex > -1 ? tokenEndIndex + index : text.length
        )
      }
      if (token) {
        // search in current scope and jump if found
        for (const item of this.current.scope) {
          if (item.ident === token) {
            this.selectModule(item.language, item.module, item.ident, item.lines)
            return
          }
        }
      }
    }
  }
})

// Like String.prototype.search but finds the last match
function searchLast (s, patt) {
  const m = s.search(patt)
  if (m === -1) return -1
  else {
    const m2 = searchLast(s.slice(m + 1), patt)
    return (m2 === -1) ? m : (m2 + m + 1)
  }
}

// Search in a sorted list
// Returns item on exact match, otherwise false
function find (data, term, min, max) {
  if (min === undefined) min = 0
  if (max === undefined) max = data.length
  var mid = Math.round((max - min) / 2) + min
  if (mid > min && mid < max) {
    var elem = data[mid]
    if (term === elem.symbol) return elem
    if (term < elem.symbol) return find(data, term, min, mid)
    if (term > elem.symbol) return find(data, term, mid, max)
  } else {
    for (var m in [min, mid, max]) {
      if (term === data[m].symbol) return data[m]
    }
    return false
  }
}

// Triggered by browser action (back/forward), NOT history.pushState()
window.addEventListener('popstate', (event) => {
  const s = event.state
  if (s) {
    app.loadModule(s.language, s.module, s.ident, s.lines)
  } else if (window.location.hash) {
    app.loadModuleFromHash(window.location.hash)
  } else {
    app.clearCurrent()
  }
})

// https://github.com/vuejs/vue/issues/9200#issuecomment-468512304
function doubleRaf (callback) {
  requestAnimationFrame(() => {
    requestAnimationFrame(callback)
  })
}
