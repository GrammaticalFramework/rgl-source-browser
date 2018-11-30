/* global $ hljs alert */

// Adjust heights
$(window).on('resize', function () {
  // $('#col-menu').height($(window).height())
  var extra = 20 // padding-top // TODO be exact
  $('.tab-content').height($(window).height() - ($('ul.nav-tabs').outerHeight() + extra))
})
$(window).trigger('resize')

// Path to data
var INDEX_PATH = 'data/index.json'

// Main app
var app
$(document).ready(function () {
  app = new App(function () {
    // ===== URL history =====
    $.history.on('load change push pushed', function (event, url, type) {
      var stripExt = function (s) {
        var i = s.lastIndexOf('.')
        return (i > -1) ? s.substr(0, i) : s
      }

      var s = url.split('/')
      var lang = s[0]
      var module = stripExt(s[1])
      var parseLineNo = s[1].match(/:(\d+)(-(\d+))?$/)

      if (app.state.current.equals(lang, module)) {
        if (parseLineNo) {
          app.scrollToCodeLine(parseInt(parseLineNo[1]))
        }
        // else there's nothing to do!
      } else {
        if (parseLineNo !== null) {
          app.loadFile(lang, module, parseInt(parseLineNo[1]))
        } else {
          app.loadFile(lang, module)
        }
      }
    }).listen('hash')
  })
})

function App (oninit) {
  var t = this

  // ===== State information =====

  this.state = {
    index: undefined,
    lookup: {},
    loadCount: 0,
    recentCount: 5,
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
    title: $('title').text(),
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
      var line = $('#code [data-line-number=' + lineNo + ']')
      var y = Math.max(line.offset().top - $('#code .hljs').offset().top - 75, 0)
      $('#code').parent().animate({ scrollTop: y }, 'slow', function () {
        t.highlight(line.parent().parent())
      })
    })
  }
  this.highlight = function (obj) {
    obj.css('background-color', '#eee')
    setTimeout(function () {
      obj.css('background-color', '')
    }, 1500)
  }

  this.clearScope = function (msg) {
    $('#scope #results').empty()
    t.updateScopeCount()
    if (msg) {
      $('#scope #results').html('<tr><td colspan="5" class="text-center">' + msg + '</td></tr>')
    }
  }
  this.clearCode = function (msg) {
    $('#code pre code').empty()
    if (msg) {
      $('#code pre code').html('<em>' + msg + '</em>')
    }
  }
  this.setCode = function (code) {
    var elem = $('#code pre code').text(code)
    hljs.highlightBlock(elem[0])
    hljs.lineNumbersBlock(elem[0])
  }
  this.updateScopeCount = function () {
    $('#scope #count').text($('#scope #results tr:visible').length)
  }
  this.updateAPICount = function () {
    $('#api #count').text($('#api #results tr:visible').length)
  }

  // hash should be '#code'
  this.showPanel = function (hash, callback) {
    $('a[data-toggle=tab][href="' + hash + '"]').trigger('click')
    setTimeout(function () {
      if (typeof callback === 'function') callback() // not a real callback :(
      t.updateScopeCount()
    }, 200)
  }

  this.setTitle = function (s) {
    $('#module_name').html(s)
    $('title').html(t.state.title + ': ' + s)
  }

  // ===== Initialization =====

  // Load the index file and populate language & module lists
  $.ajax({
    url: INDEX_PATH,
    dataType: 'json',
    type: 'GET',
    success: function (data) {
      t.state.index = data

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
      var menu = $('#menu')
      for (lang in data['languages']) {
        $('<a>')
          .attr('href', '#')
          .attr('data-language', lang)
          .attr('data-status', 'closed')
          .addClass('list-group-item list-group-item-action directory')
          .append(
            '<i class="fas fa-folder"></i> ',
            lang
          )
          .appendTo(menu)
        for (module of data['languages'][lang]) {
          $('<a>')
            .attr('href', '#' + lang + '/' + module + '.gf')
            .attr('data-language', lang)
            .attr('data-module', module)
            .addClass('list-group-item list-group-item-action module')
            .text(module)
            .appendTo(menu)
            .hide()
        }
      }
      menu.find('a.directory').click(function () {
        var elem = $(this)
        if (elem.attr('data-status') === 'open') {
          t.setMenuDirectoryState(elem, 'closed')
          menu.find('.module[data-language=' + elem.attr('data-language') + ']').hide()
        } else {
          t.setMenuDirectoryState(elem, 'open')
          menu.find('.module[data-language=' + elem.attr('data-language') + ']').show()
        }
        return false
      })

      // Module search box
      $('#module-search').keyup(delay(function () {
        t.searchModule($(this).val())
      }, 500))

      // TODO
      // Recent modules
      // $('<div>')
      //   .attr('id', 'recent')
      //   .appendTo('#languages')

      // Initialize API results
      t.initAPI()

      // Run post-init hook
      if (typeof oninit === 'function') oninit()

      // Done
      t.hideLoading()
    },
    error: function () {
      t.hideLoading()
      alert('Error getting index.')
    }
  })

  this.setMenuDirectoryState = function (objOrSel, state) {
    var elem = (typeof objOrSel === 'string') ? $('#menu .directory[data-language=' + objOrSel + ']') : objOrSel
    var icon = elem.find('i.fas')
    elem.attr('data-status', state)
    if (state === 'closed') {
      icon.removeClass('fa-folder-open').addClass('fa-folder')
    } else if (state === 'open') {
      icon.removeClass('fa-folder').addClass('fa-folder-open')
    }
  }

  // ===== Loading functionality =====

  // Load both scope & source for a file
  this.loadFile = function (lang, module, lineNo) {
    t.setTitle(lang + '/' + module)
    $('#menu a.module.active').removeClass('active')
    $('#menu a.module[data-language=' + lang + '][data-module=' + module + ']').addClass('active')
    var dir = $('#menu a.directory[data-language=' + lang + ']')
    if (dir.attr('data-status') !== 'open') dir.trigger('click')
    t.state.current.set(lang, module)
    t.loadTagsFile(module)
    t.loadSourceFile(lang, module, lineNo)
    // TODO
    // if ($('.tab.api').hasClass('active')) {
    //   t.showPanel('#scope')
    // }
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
      url: t.state.index.tags_path + '/' + module + '.gf-tags',
      type: 'GET',
      dataType: 'text',
      success: function (data) {
        // var tbody = $('#scope table tbody')
        var tbody = $('#scope #results')
        // data.replace(/^(\S+)\s(\S+)\s(.+)?$/gm, function (a, b, c, d) {
        data.split('\n').forEach(function (line) {
          if (!line) return
          var s = line.split('\t')
          var className, ident, jtype, modloc, ftype
          ident = s[0]
          if (s[1] === 'indir') {
            className = 'indir'
            var module = s[4].substring(s[4].lastIndexOf('/') + 1, s[4].lastIndexOf('.'))
            var lang = t.lookupModuleLanguage(module)
            modloc = lang + '/' + module
            jtype = '<span class="text-muted">(indir)</span>'
            if (s[2]) jtype += ' ' + s[2]
            if (s[3]) jtype += '/' + s[3]
          } else {
            className = 'local'
            jtype = s[1]
            var bits = s[2].split('/') // [..., ..., 'english', 'AdjectiveEng.gf:43-46']
            modloc = bits[bits.length - 2] + '/' + bits[bits.length - 1]
            ftype = s[3]
          }
          var url = '#' + modloc
          $('<tr>').addClass(className).attr('data-name', ident).append(
            $('<th>').append($('<code>').text(ident)),
            $('<td>').html(jtype),
            $('<td>').append($('<a>').attr('href', url).text(modloc)),
            $('<td>').text(ftype)
          ).appendTo(tbody)
        })
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
      url: t.state.index.src_path + '/' + lang + '/' + module + '.gf',
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
        url: t.state.index.tags_path + '/' + module + '.gf-tags',
        type: 'GET',
        dataType: 'text',
        success: function (data) {
          // var tbody = $('#api table tbody')
          var tbody = $('#api #results')
          data.split('\n').forEach(function (line) {
            if (!line) return
            var s = line.split('\t')
            if (s[1] !== 'indir') {
              var ident = s[0]
              var jtype = s[1]
              if (jtype) {
                var bits = s[2].split('/') // [..., ..., 'english', 'AdjectiveEng.gf:43-46']
                var modloc = bits[bits.length - 2] + '/' + bits[bits.length - 1]
                var url = '#' + modloc
                var ftype = s[3]
                $('<tr>').attr('data-name', ident).append(
                  $('<th>').append($('<code>').text(ident)),
                  $('<td>').text(jtype),
                  $('<td>').append($('<a>').attr('href', url).text(modloc)),
                  $('<td>').text(ftype)
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
    t.showLoading()
    $('#menu .directory').hide()
    var langsToShow = []
    $('#menu .module').hide().each(function () {
      var elem = $(this)
      if (elem.attr('data-module').toLowerCase().indexOf(s.toLowerCase()) > -1) {
        elem.show()
        if (!langsToShow.includes(elem.attr('data-language'))) langsToShow.push(elem.attr('data-language'))
      }
    })
    for (var lang of langsToShow) {
      var dir = $('#menu .directory[data-language=' + lang + ']')
      dir.show()
      t.setMenuDirectoryState(dir, 'open')
    }
    t.hideLoading()
  }

  this.clearSearchModule = function () {
    $('#menu .directory').show().each(function (x, m) { t.setMenuDirectoryState($(m), 'closed') })
    $('#menu .module').hide()
    $('#menu .directory[data-language=' + t.state.current.language + ']').trigger('click')
  }

  // ===== Filtering of scope info =====

  // TODO

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

  // ===== API filter =====

  // TODO

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

// ===== Helpers =====

// Delay event-handler and avoid multiple calls before timeout
// Specifically for waiting until user input pauses before searching
// https://stackoverflow.com/a/1909508/98600
function delay (callback, ms) {
  var timer = 0
  return function () {
    var context = this
    var args = arguments
    clearTimeout(timer)
    timer = setTimeout(function () {
      callback.apply(context, args)
    }, ms || 0)
  }
}
