/* global $ prettyPrint alert */

// Adjust heights
$(window).on('resize', function () {
  // $('#col-menu').height($(window).height())
  var extra = 20 // padding-top // TODO be exact
  $('.tab-content').height($(window).height() - ($('ul.nav-tabs').outerHeight() + extra))
})
$(window).trigger('resize')

// Path to data
var DATA_PATH = 'data/'

// Main app
var app
$(document).ready(function () {
  app = new App()

  // ===== URL history =====
  $.history.on('load change push pushed', function (event, url, type) {
    var stripExt = function (s) {
      var i = s.lastIndexOf('.')
      return (i > -1) ? s.substr(0, i) : s
    }

    var s = url.split('/')
    var lang = s[0]
    var module = stripExt(s[1])
    var parseLineNo = s[1].match(/:(\d + )(-(\d + ))?$/)

    if (app.state.current.equals(lang, module)) {
      if (parseLineNo) {
        app.scrollToCodeLine(parseInt(parseLineNo[1]))
      }
      // else there's nothing to do!
    } else {
      if (parseLineNo !== undefined) {
        app.loadFile(lang, module, parseInt(parseLineNo[1]))
      } else {
        app.loadFile(lang, module)
      }
    }
  }).listen('hash')
})

function App () {
  var t = this

  // ===== State information =====

  this.state = {
    index: undefined,
    lookup: {},
    loadCount: 0,
    recentCount: 5,
    language: undefined, // lang of drop-down
    current: { // current file
      language: undefined,
      module: undefined,
      set: function (lang, module) {
        t.state.current.language = lang
        t.state.current.module = module
      },
      equals: function (a, b) {
        if (!b) {
          return (a === t.state.current.module)
        } else {
          return (a === t.state.current.language) && (b === t.state.current.module)
        }
      }
    },
    title: 'RGL Source Browser',
    urlPrefix: '/',
    defaultLangs: ['abstract', 'api', 'common', 'prelude']
  }

  this.lookupModuleLanguage = function (module) {
    var l = t.state.lookup[module]
    if (l === undefined || l.length === 0) {
      return null
    } else if (l.length === 1) {
      return l[0]
    } else {
      for (var i in l) {
        if ($.inArray(l[i], t.state.defaultLangs)) {
          return l[i]
        }
      }
      return l[0] // no preferred default, just return first...
    }
  }
  this.lookupAllModuleLanguages = function (module) {
    return t.state.lookup[module]
  }

  // ===== Utility/UI functions =====

  this.showLoading = function () {
    t.state.loadCount++
    $('#loading').show()
  }
  this.hideLoading = function () {
    t.state.loadCount = Math.max(t.state.loadCount - 1, 0)
    if (t.state.loadCount === 0) {
      $('#loading').hide()
    }
  }

  this.scrollToTop = function () {
    $('html, body').animate({ scrollTop: 0 }, 'slow')
  }
  this.scrollToCodeLine = function (lineNo) {
    t.showPanel('#code', function () {
      // Find exact line, using the classes generated by google prettify
      try {
        var obj = $('#code pre li.L' + (lineNo % 10) + ':eq(' + Math.floor(lineNo / 10) + ')').prev()
        var y = Math.max(obj.offset().top - obj.parent().offset().top - 75, 0)
        $('#code').parent().animate({ scrollTop: y }, 'slow', function () {
          t.highlight(obj)
        })
      } catch (e) {}
    })
  }
  this.highlight = function (obj) {
    obj.css('background-color', 'yellow')
    setTimeout(function () {
      obj.css('background-color', '')
    }, 1500)
  }

  this.clearScope = function (msg) {
    $('#scope #results').empty()
    t.updateScopeCount()
    if (msg) {
      $('#scope #results').html('<em>' + msg + '</em>')
    }
  }
  this.setScope = function (code) {
    $('#scope #results').html(code)
  }
  this.clearCode = function (msg) {
    $('#code pre').empty()
    if (msg) {
      $('#codes pre').html('<em>' + msg + '</em>')
    }
  }
  this.setCode = function (code) {
    $('#code pre').text(code)
    prettyPrint()
  }
  this.updateScopeCount = function () {
    $('#scope #count').text($('#scope #results tr:visible').length)
  }
  this.updateAPICount = function () {
    $('#api #count').text($('#api #results tr:visible').length)
  }

  this.setLanguage = function (lang) {
    t.state.language = lang
    $('#languages select').val(lang)
    t.initModules(lang)
  }

  // hash should be '#code'
  this.showPanel = function (hash, callback) {
    t.showLoading()
    setTimeout(function () {
      $('.panel:visible').hide()
      $('a.tab').removeClass('active')
      $('a.tab[href="' + hash + '"]').addClass('active')
      $(hash).show(0, callback)
      t.updateScopeCount()
      t.hideLoading()
    }, 200) // this ensures the loading displays
  }
  this.getPanel = function () {
    return $('.panel:visible').first()
  }

  this.setTitle = function (s) {
    $('#module_name').html(s)
    $('title').html(t.state.title + ': ' + s)
  }

  // ===== Initialization =====

  // Initialize the panels, tabs
  $('a.tab').click(function () {
    var panel = $(this).attr('href')
    t.showPanel(panel)
    return false
  })
  t.showPanel('#scope')

  // Load the index file and populate language & module lists
  $.ajax({
    url: DATA_PATH + 'index.json',
    dataType: 'json',
    type: 'GET',
    success: function (data) {
      t.state.index = data
      if (data['urlprefix']) t.state.urlPrefix = data['urlprefix']

      // RGL commit
      if (data['commit']) {
        $('#rgl-commit')
          .append('<i class="mr-1 fas fa-code-branch"></i>', data['commit'])
          .attr('href', 'https://github.com/GrammaticalFramework/gf-rgl/tree/' + data['commit'])
      }

      // Build language lookup index
      for (var lang in data['languages']) {
        for (var module of data['languages'][lang]) {
          if (!t.state.lookup[module]) t.state.lookup[module] = []
          t.state.lookup[module].push(lang)
        }
      }

      // Initialize the language list
      var langSelect = $('<select>')
        .attr('id', 'language_select')
        .change(function () {
          t.setLanguage($(this).val())
        })
        .appendTo('#languages')
      for (lang in data['languages']) {
        $('<option>')
          .html(lang)
          .appendTo(langSelect)
      }
      t.setLanguage('english')

      // Module search box
      $('<input>')
        .attr('id', 'module_search')
        .keyup(function () {
          t.searchModule($(this).val())
        })
        .appendTo('#languages')
      $('<a>')
        .attr('href', '#')
        .click(t.clearSearchModule)
        .html('Clear')
        .appendTo('#languages')

      // Recent modules
      $('<div>')
        .attr('id', 'recent')
        .appendTo('#languages')

      // Initialize API results
      t.initAPI()

      // Done
      t.hideLoading()
    },
    error: function () {
      t.hideLoading()
      alert('Error getting index.')
    }
  })

  // ===== Loading functionality =====

  // Initialize the module list
  this.initModules = function (lang) {
    t.state.index['languages'][lang] = t.state.index['languages'][lang].sort()
    $('#modules').empty()
    for (var module of t.state.index['languages'][lang]) {
      $('<a>')
        .html(module)
        .attr('href', '#' + lang + '/' + module + '.gf')
        .appendTo('#modules')
    }
  }

  // Load both scope & source for a file
  this.loadFile = function (lang, module, lineNo) {
    t.setTitle(lang + '/' + module)
    t.state.current.set(lang, module)
    t.loadTagsFile(module)
    t.loadSourceFile(lang, module, lineNo)
    if ($('.tab.api').hasClass('active')) {
      t.showPanel('#scope')
    }
    t.addRecent(lang, module)
  }

  // Add item to recent list
  this.addRecent = function (lang, module) {
    var fullModule = lang + '/' + module
    // If already there, do nothing
    if ($('#recent').text().indexOf(fullModule) > -1) return
    // Delete oldest if at limit
    if ($('#recent a').length >= t.state.recentCount) {
      $('#recent a').last().remove()
    }
    // Add it
    $('<a>')
      .html(fullModule)
      .attr('href', '#' + lang + '/' + module + '.gf')
      .prependTo('#recent')
  }

  // Load a tags file
  this.loadTagsFile = function (module) {
    t.clearScope()
    t.showLoading()
    $.ajax({
      url: DATA_PATH + module + '.gf-tags',
      type: 'GET',
      dataType: 'text',
      success: function (data) {
        data = data.replace(/^(\S + )\s(\S + )\s(. + )?$/gm, function (a, b, c, d) {
          var s = d.split('\t')
          var className, url, name, c1, c2, c3
          if (c === 'indir') {
            var module = s[2].substring(s[2].lastIndexOf('/') + 1, s[2].lastIndexOf('.'))
            var lang = t.lookupModuleLanguage(module)
            name = lang + '/' + module
            url = '#' + lang + '/' + module
            className = 'indir'
            c1 = s[0]
            c2 = s[1]
            c3 = ''
          } else {
            var bits = s[0].split('/') // ['lib', 'src', 'english', 'AdjectiveEng.gf:43-46']
            name = bits[3] + '/' + bits[4]
            url = '#' + bits[3] + '/' + bits[4]
            c1 = ''
            c2 = ''
            c3 = s[1]
            className = 'local'
          }
          return $('<tr>').addClass(className).attr('data-name', b).append(
            $('<th>').text(b),
            $('<td>').text(c),
            $('<td>').text(c1),
            $('<td>').text(c2),
            $('<td>').append($('<a>').attr('href', url).text(name)),
            $('<td>').text(c3)
          ).html()
        })
        t.setScope(data)
        t.runFilter()
        t.hideLoading()
      },
      error: function (data) {
        t.clearScope('No scope available')
        t.hideLoading()
      }
    })
  }

  // Load a source module
  this.loadSourceFile = function (lang, module, lineNo) {
    t.clearCode()
    t.showLoading()
    $.ajax({
      url: t.state.urlPrefix + 'lib/src/' + lang + '/' + module + '.gf',
      type: 'GET',
      dataType: 'text',
      success: function (data, status, xhr) {
        t.setCode(data)
        t.hideLoading()
        if (lineNo) {
          t.scrollToCodeLine(lineNo)
        }
      },
      error: function (data) {
        t.clearCode('No code available')
        t.hideLoading()
      }
    })
  }

  // Which modules do we include for API?
  this.apiModules = [
    // api
    'Syntax'
    // 'Constructors', 'Cat', 'Structural', 'Combinators',
    // abstract
    // 'Adjective',
    // 'Adverb',
    // 'Backward',
    // 'Cat',
    // 'Common',
    // 'Compatibility',
    // 'Conjunction',
    // 'Extra',
    // 'Grammar',
    // 'Idiom',
    // 'Lang',
    // 'Lexicon',
    // 'Noun',
    // 'Numeral',
    // 'NumeralTransfer',
    // 'Phrase',
    // 'Question',
    // 'Relative',
    // 'Sentence',
    // 'Structural',
    // 'Symbol',
    // 'Tense',
    // 'Text',
    // 'Transfer',
    // 'Verb',
  ]
  this.initAPI = function () {
    t.showLoading()
    // Copy HTML from Scope tab
    $('#api').html($('#scope').html())
    for (var i in t.apiModules) {
      var module = t.apiModules[i]
      $.ajax({
        url: DATA_PATH + module + '.gf-tags',
        type: 'GET',
        dataType: 'text',
        success: function (data) {
          var tbody = $('#api table tbody')
          data.replace(/^(\S+)\s(\S+)\s(.+)?$/gm, function (a, b, c, d) {
            var s = d.split('\t')
            if (c !== 'indir') {
              var type = s[1]
              if (type) {
                var bits = s[0].split('/') // ['lib', 'src', 'english', 'AdjectiveEng.gf:43-46']
                var name = bits[3] + '/' + bits[4]
                var url = '#' + bits[3] + '/' + bits[4]
                $('<tr>').attr('data-name', b).append(
                  $('<th>').append($('<code>').text(b)),
                  $('<td>').text(c),
                  $('<td>').append($('<a>').attr('href', url).text(name)),
                  $('<td>').text(''),
                  $('<td>').text(s[1])
                ).appendTo(tbody)
              }
            }
          })
          $('#api #count').text(tbody.find('tr').length)
        },
        error: function (data) {
          console.log('Error loading tags file: ' + module)
        }
      })
    }
    t.hideLoading()
  }

  // ===== Module search =====

  this.searchModule = function (s) {
    if (!s) {
      return t.clearSearchModule()
    }
    $('#language_select').hide()
    $('#modules').empty()
    for (var lang in t.state.index['languages']) {
      var modules = t.state.index['languages'][lang]
      for (var module of modules) {
        var fullModule = lang + '/' + module
        if (fullModule.toLowerCase().indexOf(s.toLowerCase()) === -1) continue
        $('<a>')
          .html(fullModule)
          .attr('href', '#' + lang + '/' + module + '.gf')
          .appendTo('#modules')
      }
    }
  }

  this.clearSearchModule = function () {
    $('#module_search').val('')
    $('#language_select').show()
    t.setLanguage(t.state.language)
    return false
  }

  // ===== Filtering of scope info =====

  // Custom selector
  $.expr[':'].match = function (a, b, c) {
    var obj = $(a)
    var needle = c[3]
    var haystack = obj.attr('data-name')
    if (haystack === undefined) {
      return false
    }
    if ($('#scope #case_sensitive').is(':checked')) {
      return haystack.indexOf(needle) >= 0
    } else {
      return haystack.toLowerCase().indexOf(needle.toLowerCase()) >= 0
    }
  }

  this.runFilter = function () {
    t.showLoading()
    $('#scope #results tr').removeClass('odd')
    var s = $('#scope #search').val()
    try {
      if (s) {
        $('#scope #results tr').hide()
        $('#scope #results tr:match(\'' + s + '\')').show()
      } else {
        $('#scope #results tr').show()
      }
      if ($('#scope #show_local').is(':checked')) {
        $('#scope #results tr.indir').hide()
      }
    } catch (error) {
      alert(error.message)
    }
    t.updateScopeCount()
    $('#scope #results tr:visible:odd').addClass('odd')
    t.hideLoading()
  }

  // Instant results
  this.prevSearch = $('#scope #search').val()
  $('#scope #search').keyup(function () {
    var s = $('#scope #search').val()
    if (s !== t.prevSearch) {
      t.runFilter()
      t.prevSearch = s
    }
  })

  $('#scope #search').keypress(function (e) {
    var code = (e.keyCode ? e.keyCode : e.which)
    if (code === 13) { // Enter
      t.runFilter()
    }
  })
  $('#scope #clear').click(function () {
    $('#scope #search')
      .val('')
      .focus()
    t.runFilter()
  })
  $('#scope #case_sensitive').change(t.runFilter)
  $('#scope #show_all').change(t.runFilter)
  $('#scope #show_local').change(t.runFilter)

  // ===== API search =====

  // Custom selector
  $.expr[':'].matchAPI = function (a, b, c) {
    var obj = $(a) // tr
    var ident = $(obj.children().get(0)).text()
    var type = $(obj.children().get(3)).text()
    var needle = c[3]
    var matchIdent = ident.toLowerCase().indexOf(needle.toLowerCase()) >= 0
    var matchType = type.toLowerCase().indexOf(needle.toLowerCase()) >= 0
    // if ($('#scope #case_sensitive').is(':checked'))
    //   return haystack.indexOf(needle)>=0
    // else
    return matchIdent || matchType
  }

  this.runFilterAPI = function () {
    t.showLoading()
    $('#api #results tr').removeClass('odd')
    var s = $('#api #search').val()
    try {
      if (s) {
        $('#api #results tr').hide()
        $('#api #results tr:matchAPI(\'' + s + '\')').show()
      } else {
        $('#api #results tr').show()
      }
    } catch (error) {
      alert(error.message)
    }
    t.updateAPICount()
    $('#api #results tr:visible:odd').addClass('odd')
    t.hideLoading()
  }

  // Instant results
  this.prevAPISearch = $('#api #search').val()
  $('#api #search').keyup(function () {
    var s = $('#api #search').val()
    if (s !== t.prevAPISearch) {
      t.runFilterAPI()
      t.prevAPISearch = s
    }
  })

  $('#api #search').keypress(function (e) {
    var code = (e.keyCode ? e.keyCode : e.which)
    if (code === 13) { // Enter
      t.runFilterAPI()
    }
  })
  $('#api #clear').click(function () {
    $('#api #search')
      .val('')
      .focus()
    t.runFilterAPI()
  })
}
