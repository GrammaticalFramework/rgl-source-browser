/* global Vue axios hljs */
/* eslint-disable comma-dangle */

// Path to data
const INDEX_PATH = 'data/index.json'

const defaultLangs = ['abstract', 'api', 'common', 'prelude']

new Vue({ // eslint-disable-line no-new
  el: '#app',
  data: {
    index: null,
    lookup: [],
    rgl_commit: null,
    search_term: null, // linked to input
    search_terms: [], // internal, processed
    show: {
      results: false,
      loading: true,
      history: true,
      scope: true,
      code: true,
    },
    current: {
      language: null,
      module: null,
      scope: null,
      code: null,
    },
    history: []
  },
  computed: {
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
        ss.every(s => sc.toString().includes(s))
      )
    }
  },
  watch: {
    search_term: function () {
      this.search_terms = this.search_term.toLowerCase().split(/ +/).filter(s => s.length > 2)
      this.show.results = true
    },
    'current.code': function () {
      Vue.nextTick(this.highlightCode)
    },
  },
  mounted: function () {
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

        this.show.loading = false
      })
  },
  methods: {
    selectModule: function (lang, module, lines = null) { // TODO lines
      if (lang === this.current.language && module === this.current.module) {
        // TODO just scroll
        return
      }
      this.show.loading = true
      this.show.results = false
      Promise.all([
        axios.get(`${this.index.tags_path}/${module}.gf-tags`)
          .then(resp => {
            this.current.scope = this.processTags(resp.data)
          }),
        axios.get(`${this.index.src_path}/${lang}/${module}.gf`)
          .then(resp => {
            this.current.code = resp.data
          }),
      ]).then(() => {
        this.current.language = lang
        this.current.module = module

        this.history = this.history.filter(h => !(h.language === lang && h.module === module))
        this.history.push({
          language: lang,
          module: module,
        })

        this.show.loading = false
      })
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
          r.lines = modline.slice(modline.indexOf(':') + 1) // 46-53
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
      const elem = document.querySelector('#code')
      if (!elem) return
      hljs.highlightBlock(elem)
      if (hljs.lineNumbersBlock) hljs.lineNumbersBlock(elem)
    }
  }
})
