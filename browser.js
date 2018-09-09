/* global $ */

// Adjust heights
$(window).on('resize', function () {
  // $('#col-menu').height($(window).height())
  var extra = 20 // padding-top // TODO be exact
  $('.tab-content').height($(window).height() - ($('ul.nav-tabs').outerHeight() + extra))
})
$(window).trigger('resize')
