/*
 * humanMsg - Plugin for jQuery
 * 
 * My implementation of humanized messages http://ajaxian.com/archives/humanized-messages-library
 * 
 * @depends: jquery.js
 * @version 0.2
 * @license Dual licensed under the MIT and GPL licenses.
 * @author  Oleg Slobodskoi aka Kof
 * @website http://jsui.de
 */

(function($, window){
    
$.fn.humanMsg = function( message, options ) {
    return this.each(function(){
        var container = this == window || this == document ? document.body : this;
        !$.data(container, 'humanMsg') && $.data(container, 'humanMsg', new $.humanMsg (container, message, options) );
    });
};

$.humanMsg = function( container, message, options ) {
    if (typeof message == 'object') {
        options = message;
        message = null;
    }

    var s = $.extend({}, $.humanMsg.defaults, options);

    var $m,
        sizeContainer = container == document.body ? window : container;
    
    $m = $('<div class="humanized-message '+s.addClass+'"/>')
    .html(message || s.message)
    .click(remove)
    .appendTo(container);

    $m.css({
        display: 'none',
        visibility: 'visible',
        top: ($(sizeContainer).height()-$m.innerHeight())/2,
        left: ($(sizeContainer).width()-$m.innerWidth())/2
    })
    .fadeIn(s.speed);
        
    s.autoHide && setTimeout(remove, s.autoHide);   

    function remove() {
        $m.fadeOut(s.speed, function(){
            $m.remove();
            $.removeData(container, 'humanMsg');
        });
    }

};

$.humanMsg.defaults = {
    message: 'no message was set',
    autoHide: 3000,
    addClass: '',
    speed: 300
};

})(jQuery, this);