var cards = {};
var totalcolumns = 0;
var columns = [];
var currentTheme = "bigcards";
var boardInitialized = false;
var keyTrap = null;

var baseurl = location.pathname.substring(0, location.pathname.lastIndexOf('/'));
var socket = io.connect({path: baseurl + "/socket.io"});

moment.locale(navigator.language || navigator.languages[0]);

//an action has happened, send it to the
//server
function sendAction(a, d) {
  //console.log('--> ' + a);

  var message = {
    action: a,
    data: d
  };

  socket.json.send(message);
}

socket.on('connect', function () {
  //console.log('successful socket.io connect');

  // FIXME smoreau: could connexion diagram be different ? currently we have
  // FIXME   client > server: joinRoom
  // FIXME   server > client: roomAccept
  // FIXME   client > server: initializeMe

  //imediately join the room which will trigger the initializations
  sendAction('joinRoom', location.href);
});

socket.on('disconnect', function () {
  blockUI("Server disconnected. Refresh page to try and reconnect...");
  //$('.blockOverlay').click($.unblockUI);
});

socket.on('message', function (data) {
  getMessage(data);
});

function unblockUI() {
  $.unblockUI({fadeOut: 50});
}

function blockUI(message) {
  message = message || 'Waiting...';

  $.blockUI({
    message: message,

    css: {
      border: 'none',
      padding: '15px',
      backgroundColor: '#000',
      '-webkit-border-radius': '10px',
      '-moz-border-radius': '10px',
      opacity: 0.5,
      color: '#fff',
      fontSize: '20px'
    },

    fadeOut: 0,
    fadeIn: 10
  });
}

//respond to an action event
function getMessage(m) {
  var message = m; //JSON.parse(m);
  var action = message.action;
  var data = message.data;

  //console.log('<-- ' + action);

  switch (action) {
    case 'roomDeny':
      //this doesn't happen yet
      break;

    case 'moveCard':
      moveCard($("#" + data.id), data.position);
      break;

    case 'initCards':
      initCards(data, message.highlight);
      break;

    case 'createCard':
      //console.log(data);
      drawNewCard(data.id, data.x, data.y, data.rot, data.colour, data.text, data.desc);
      break;

    case 'deleteCard':
      $("#" + data.id).fadeOut(500,
        function () {
          $(this).remove();
        }
      );
      break;

    case 'editCard':
      $("#" + data.id).children('.content:first').data('text', data.value);
      $("#" + data.id).children('.content:first').data('description', data.desc);
      $("#" + data.id).children('.content:first').html(marked(data.value));
      break;

    case 'initColumns':
      initColumns(data);
      break;

    case 'updateColumns':
      initColumns(data);
      break;

    case 'changeTheme':
      changeThemeTo(data);
      break;

    case 'join-announce':
      displayUserJoined(data.sid, data.user_name);
      break;

    case 'leave-announce':
      displayUserLeft(data.sid);
      break;

    case 'initialUsers':
      displayInitialUsers(data);
      break;

    case 'nameChangeAnnounce':
      updateName(message.data.sid, message.data.user_name);
      break;

    case 'addSticker':
      addSticker(message.data.cardId, message.data.stickerId);
      break;

    case 'setBoardSize':
      resizeBoard(message.data);
      break;

    case 'setColumnSize':
      resizeColumn(message.data);
      break;

    case 'export':
      download(message.data.filename, message.data.text);
      break;

    case 'addRevision':
      addRevision(message.data);
      break;

    case 'deleteRevision':
      $('#revision-' + message.data).remove();
      break;

    case 'initRevisions':
      $('#revisions-list').empty();
      for (var i = 0; i < message.data.length; i++) {
        addRevision(message.data[i]);
      }
      break;

    default:
      //unknown message
      alert('unknown action: ' + JSON.stringify(message));
      break;
  }


}

$(document).bind('keyup', function (event) {
  keyTrap = event.which;
});

function createNewScrumBoard() {
  var $board = $('#board');
  var width = $board.width();
  var todoColumnWidth = 70*(width - 200*3)/100;

  var columns = [
    { title: 'Story', width: 200 },
    { title: 'Todo', width: todoColumnWidth },
    { title: 'In Progress', width: 200 },
    { title: 'In Review', width: 200 },
    { title: 'Done' }
  ];
  initColumns(columns);
  sendAction('updateColumns', columns);

  createCard(0, 100, 'yellow', 'a useful feature for user');
  createCard(200, 100, 'blue', 'an atomic task to do');
  createCard(200 + todoColumnWidth, 100, 'blue', 'an atomic task being done');
  createCard(200 + todoColumnWidth + 200, 100, 'blue', 'an atomic task reviewed by others and/or being tested');
  createCard(200 + todoColumnWidth + 2*200, 100, 'blue', 'an atomic task done done');
}

function drawNewCard(id, x, y, rot, colour, text, description, sticker, animationspeed) {
  //cards[id] = {id: id, text: text, x: x, y: y, rot: rot, colour: colour};

  if (typeof text === 'undefined' || null === text)
    text = '';

  if (typeof description === 'undefined')
    description = '';

  var h = '<div id="' + id + '" class="card ' + colour + ' draggable" style="-webkit-transform:rotate(' + rot +
    'deg);\
">\
<i class="fa fa-window-close card-icon delete-card-icon" aria-hidden="true" title="Delete post-it"></i>\
<i class="fa fa-window-maximize card-icon card-details-icon" aria-hidden="true" title="Minimize/maximize post-it content"></i>\
<img class="card-image" src="images/' + colour + '-card.png">\
  <div id="content:' + id + '" class="content stickertarget droppable">' + marked(text) + '</div>\
  <span class="filler"></span>\
  </div>';

  var card = $(h);
  card.appendTo('#board');
  var $cardContent = $("#" + id).children('.content:first');
  $cardContent.data('text', text);
  $cardContent.data('description', description);

  var $detailsButton = $("#" + id).find('.card-details-icon');

  //@TODO
  //Draggable has a bug which prevents blur event
  //http://bugs.jqueryui.com/ticket/4261
  //So we have to blur all the cards and editable areas when
  //we click on a card
  //The following doesn't work so we will do the bug
  //fix recommended in the above bug report
  // card.click( function() {
  // 	$(this).focus();
  // } );

  card.draggable({
    snap: false,
    snapTolerance: 5,
    containment: [0, 0, 2000, 2000],
    stack: ".card",
    start: function (event, ui) {
      keyTrap = null;
    },
    drag: function (event, ui) {
      if (keyTrap == 27) {
        ui.helper.css(ui.originalPosition);
        return false;
      }
    },
    handle: "div.content"
  });

  //After a drag:
  card.bind("dragstop", function (event, ui) {
    if (keyTrap == 27) {
      keyTrap = null;
      return;
    }

    var data = {
      id: this.id,
      position: ui.position,
      oldposition: ui.originalPosition,
    };

    sendAction('moveCard', data);
  });

  card.children(".droppable").droppable({
    accept: '.sticker',
    drop: function (event, ui) {
      var stickerId = ui.draggable.attr("id");
      var cardId = $(this).parent().attr('id');

      addSticker(cardId, stickerId);

      var data = {
        cardId: cardId,
        stickerId: stickerId
      };
      sendAction('addSticker', data);

      //remove hover state to everything on the board to prevent
      //a jquery bug where it gets left around
      $('.card-hover-draggable').removeClass('card-hover-draggable');
    },
    hoverClass: 'card-hover-draggable'
  });

  var speed = Math.floor(Math.random() * 1000);
  if (typeof(animationspeed) != 'undefined') speed = animationspeed;

  var startPosition = $("#create-card").position();

  card.css('top', startPosition.top - card.height() * 0.5);
  card.css('left', startPosition.left - card.width() * 0.5);

  card.animate({
    left: x + "px",
    top: y + "px"
  }, speed);

  card.hover(
    function () {
      $(this).addClass('hover');
      $(this).children('.card-icon').fadeIn(10);
    },
    function () {
      $(this).removeClass('hover');
      $(this).children('.card-icon').fadeOut(150);
    }
  );

  card.children('.card-icon').hover(
    function () {
      $(this).addClass('card-icon-hover');
    },
    function () {
      $(this).removeClass('card-icon-hover');
    }
  );

  card.children('.delete-card-icon').click(
    function () {
      $("#" + id).remove();
      //notify server of delete
      sendAction('deleteCard', {
        'id': id
      });
    }
  );

  function getMarkDownData() {
    var data;
    if (!card.hasClass('details')) {
      data = card.children('.content:first').data('text');
    } else {
      var desc = card.children('.content:first').data('description');
      data = '# ' + card.children('.content:first').data('text') + '\n' +
        (desc ? desc.replace(/\n/g, '\n') : '');
    }
    return data;
  }

  card.children('.card-details-icon').click(function () {
    if (card.hasClass('details')) {
      card.removeClass('details');
      card.find('.card-image').show();
      $detailsButton.removeClass('fa-window-restore').addClass('fa-window-maximize');
    } else {
      card.addClass('details');
      card.find('.card-image').hide();
      $detailsButton.removeClass('fa-window-maximize').addClass('fa-window-restore');
    }
    var htmlData = marked(getMarkDownData());
    card.find('.content:first').html(htmlData);
  });

  card.children('.content').editable(function (value, settings) {
    if (!card.hasClass('details')) {
      $("#" + id).children('.content:first').data('text', value);
      onCardChange(id, value);
    } else {
      var lines = value.split('\n');
      var title = lines[0].replace(/^# /g, '').trim();
      lines.splice(0,1);
      var description = lines.join('\n');
      $("#" + id).children('.content:first').data('text', title);
      $("#" + id).children('.content:first').data('description', description);
      onCardChange(id, title, description);
    }
    return (marked(value));
  }, {
    type: 'textarea',
    data: function () {
      return getMarkDownData();
    },
    submit: 'OK',
    style: 'inherit',
    cssclass: 'card-edit-form',
    placeholder: 'Double Click to Edit.',
    onblur: 'submit',
    event: 'dblclick', //event: 'mouseover'
  });

  //add applicable sticker
  if (typeof sticker !== 'undefined')
    addSticker(id, sticker);
}


function onCardChange(id, text, description) {
  sendAction('editCard', {
    id: id,
    value: text,
    desc: description
  });
}

function moveCard(card, position) {
  card.animate({
    left: position.left + "px",
    top: position.top + "px"
  }, 500);
}

function addSticker(cardId, stickerIds) {

  var $stickerContainer = $('#' + cardId + ' .filler');

  if (stickerIds === "nosticker") {
    $stickerContainer.html("");
    return;
  }

  if (!Array.isArray(stickerIds)) {
    stickerIds = [ stickerIds ];
  }

  for (var i in stickerIds) {
    var stickerID = stickerIds[i];
    if ($stickerContainer.find('.' + stickerID).length === 0) {
      $stickerContainer.prepend($('#' + stickerID).clone().removeAttr('style').addClass(stickerID));
    }
  }
}


//----------------------------------
// cards
//----------------------------------
function createCard(x, y, colour, text, description) {
  if (typeof text === 'undefined')
    text = '';

  var rotation = Math.random() * 10 - 5; //add a bit of random rotation (+/- 10deg)
  var action = "createCard";
  var data = {
    text: text,
    desc: description,
    x: x,
    y: y,
    rot: rotation,
    colour: colour
  };

  sendAction(action, data);
}

function getCardColour() {
  var color;

  if ('random' == $('#card-color').val())
    color = randomCardColour();
  else
    color = $('#card-color').val();
  return color;
}

function randomCardColour() {
  var colours = ['yellow', 'green', 'blue', 'white'];

  var i = Math.floor(Math.random() * colours.length);

  return colours[i];
}


function initCards(cardArray, highlight) {
  //first delete any cards that exist
  $('.card').remove();

  cards = cardArray;

  for (var i in cardArray) {
    card = cardArray[i];

    drawNewCard(
      card.id,
      card.x,
      card.y,
      card.rot,
      card.colour,
      card.text,
      card.desc,
      card.sticker,
      0
    );
  }

  if (typeof highlight !== 'undefined') {
    $('#' + highlight).addClass('card-highlight');
  }

  boardInitialized = true;
  unblockUI();
}


//----------------------------------
// cols
//----------------------------------

function drawNewColumn(column, numberOfColumns) {
  var cls = "col";
  if (totalcolumns === 0) {
    cls = "col first";
  }

  var $newColumn = $('<td class="' + cls +
    '" style="display:none"><h2 id="col-' + (totalcolumns + 1) +
    '" class="editable">' + column.title + '</h2></td>');
  $('#icon-col').before($newColumn);

  if (totalcolumns + 1 != numberOfColumns) {
    $newColumn.width(column.width);

    $newColumn.resizable({
      handles: "e",
      helper: "ui-resizable-helper"
    });
  }

  $('.editable', $newColumn).editable(function (value, settings) {
    onColumnChange(this.id, value);
    return (value);
  }, {
    style: 'inherit',
    cssclass: 'card-edit-form',
    type: 'textarea',
    placeholder: 'New',
    onblur: 'submit',
    width: '',
    height: '',
    xindicator: '<img src="images/ajax-loader.gif">',
    event: 'dblclick', //event: 'mouseover'
  });

  $('.col:last').fadeIn(1500);

  totalcolumns++;
}

function onColumnChange(id, columnName) {
  var names = Array();

  //console.log(id + " " + text );

  //Get the names of all the columns right from the DOM
  $('.col').each(function () {
    //get ID of current column we are traversing over
    var thisID = $(this).children("h2").attr('id');
    names.push({ title: (id !== thisID ? $(this).text() : columnName), width: $(this).width()});
  });

  updateColumns(names);
}

function displayRemoveColumn() {
  if (totalcolumns <= 0) return false;

  $('.col:last').fadeOut(150,
    function () {
      $(this).remove();
      // FIXME smoreau: verify last col is properly deleted here, or remove({ put it here })
      $(".col:last").resizable('destroy');
    }
  );

  totalcolumns--;
}

function createColumn(name) {
  if (totalcolumns >= 8) return false;

  var newColumn = { title: name }

  $(".col:last").resizable({
    handles: "e",
    helper: "ui-resizable-helper"
  });

  drawNewColumn(newColumn, columns.length + 1);
  columns.push(newColumn);

  var action = "updateColumns";
  var data = columns;

  sendAction(action, data);
}

function deleteColumn() {
  if (totalcolumns <= 0) return false;

  displayRemoveColumn();
  columns.pop();

  var action = "updateColumns";

  var data = columns;

  sendAction(action, data);
}

function updateColumns(c) {
  columns = c;

  var action = "updateColumns";

  var data = columns;

  sendAction(action, data);
}

function deleteColumns(next) {
  //delete all existing columns:
  $('.col').fadeOut('slow', next());
}

function initColumns(columnArray) {
  totalcolumns = 0;
  columns = columnArray;

  $('.col').remove();

  for (var i in columnArray) {
    column = columnArray[i];

    drawNewColumn(column, columnArray.length);
  }
}


function changeThemeTo(theme) {
  currentTheme = theme;
  $("link[title=cardsize]").attr("href", "css/" + theme + ".css");

  var icons = {
    'smallcards': 'fa-search-plus',
    'bigcards': 'fa-search-minus'
  };
  var $icon = $("#smallify");
  $.map(icons, function(v) { $icon.removeClass(v); });
  $icon.addClass(icons[theme]);
}


//////////////////////////////////////////////////////////
////////// NAMES STUFF ///////////////////////////////////
//////////////////////////////////////////////////////////


function setCookie(c_name, value, exdays) {
  var exdate = new Date();
  exdate.setDate(exdate.getDate() + exdays);
  var c_value = escape(value) + ((exdays === null) ? "" : "; expires=" +
    exdate.toUTCString());
  document.cookie = c_name + "=" + c_value;
}

function getCookie(c_name) {
  var i, x, y, ARRcookies = document.cookie.split(";");
  for (i = 0; i < ARRcookies.length; i++) {
    x = ARRcookies[i].substr(0, ARRcookies[i].indexOf("="));
    y = ARRcookies[i].substr(ARRcookies[i].indexOf("=") + 1);
    x = x.replace(/^\s+|\s+$/g, "");
    if (x == c_name) {
      return unescape(y);
    }
  }
}


function setName(name) {
  sendAction('setUserName', name);

  setCookie('scrumscrum-username', name, 365);
}

function displayInitialUsers(users) {
  for (var i in users) {
    //console.log(users);
    displayUserJoined(users[i].sid, users[i].user_name);
  }
}

function displayUserJoined(sid, user_name) {
  name = '';
  if (user_name)
    name = user_name;
  else
    name = sid.substring(0, 5);


  $('#names-ul').append('<li id="user-' + sid + '">' + name + '</li>');
}

function displayUserLeft(sid) {
  name = '';
  if (name)
    name = user_name;
  else
    name = sid;

  var id = '#user-' + sid.toString();

  $('#names-ul').children(id).fadeOut(1000, function () {
    $(this).remove();
  });
}


function updateName(sid, name) {
  var id = '#user-' + sid.toString();

  $('#names-ul').children(id).text(name);
}

//////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////

function boardResizeHappened(event, ui) {
  var newsize = ui.size;

  sendAction('setBoardSize', newsize);
}

function columnResizeHappened(event, ui) {
  var newSize = ui.size;
  var columnID = $(ui.element).find('h2').attr('id').replace(/col-/g, '');

  sendAction('setColumnSize', { columnID: parseInt(columnID), width: newSize.width });
}

function resizeBoard(size) {
  $(".board-outline").animate({
    height: size.height,
    width: size.width
  });
}

function resizeColumn(column) {
  var $board = $(".board-outline");
  $board.find('h2#col-' + (column.columnID)).parent().animate({
    width: column.width
  });
}

//////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////

function calcCardOffset() {
  var offsets = {};
  $(".card").each(function () {
    var card = $(this);
    $(".col").each(function (i) {
      var col = $(this);
      if (col.offset().left + col.outerWidth() > card.offset().left +
        card.outerWidth() || i === $(".col").size() - 1) {
        offsets[card.attr('id')] = {
          col: col,
          x: ((card.offset().left - col.offset().left) / col.outerWidth())
        };
        return false;
      }
    });
  });
  return offsets;
}


//moves cards with a resize of the Board
//doSync is false if you don't want to synchronize
//with all the other users who are in this room
function adjustCard(offsets, doSync) {
  $(".card").each(function () {
    var card = $(this);
    var offset = offsets[this.id];
    if (offset) {
      var data = {
        id: this.id,
        position: {
          left: offset.col.position().left + (offset.x * offset.col
            .outerWidth()),
          top: parseInt(card.css('top').slice(0, -2))
        },
        oldposition: {
          left: parseInt(card.css('left').slice(0, -2)),
          top: parseInt(card.css('top').slice(0, -2))
        }
      }; //use .css() instead of .position() because css' rotate
      //console.log(data);
      if (!doSync) {
        card.css('left', data.position.left);
        card.css('top', data.position.top);
      } else {
        //note that in this case, data.oldposition isn't accurate since
        //many moves have happened since the last sync
        //but that's okay becuase oldPosition isn't used right now
        moveCard(card, data.position);
        sendAction('moveCard', data);
      }

    }
  });
}

//////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////

function download(filename, text) {
  var element = document.createElement('a');
  var mime = 'text/plain';
  if (filename.match(/.csv$/)) {
    mime = 'text/csv';
  }
  element.setAttribute('href', 'data:' + mime + ';charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

function addRevision(timestamp) {
  var li = $('<li id="revision-' + timestamp + '"></li>');
  var s1 = $('<span></span>');
  var s2 = $('<img src="../images/stickers/sticker-deletestar.png" alt="delete revision">');
  if (typeof(timestamp) === 'string') {
    timestamp = parseInt(timestamp);
  }
  s1.text(moment(timestamp).format('LLLL'));

  li.append(s1);
  li.append(s2);
  $('#revisions-list').append(li);

  s1.click(function () {
    socket.json.send({
      action: 'exportRevision',
      data: timestamp
    });
  });
  s2.click(function () {
    socket.json.send({
      action: 'deleteRevision',
      data: timestamp
    });
  });
}

//////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////

$(function () {


  //disable image dragging
  //window.ondragstart = function() { return false; };


  if (boardInitialized === false)
    blockUI('<img src="images/ajax-loader.gif" width=43 height=11/>');

  //setTimeout($.unblockUI, 2000);

  $("#create-card").click(function () {
    createCard(58, $('#create-card').height(), getCardColour());
  });

  $("#create-board").click(function () {
    createNewScrumBoard();
  });

  // Style changer
  $("#smallify").click(function () {
    if (currentTheme == "bigcards") {
      changeThemeTo('smallcards');
    } else if (currentTheme == "smallcards") {
      changeThemeTo('bigcards');
    }
    /*else if (currentTheme == "nocards")
{
  currentTheme = "bigcards";
  $("link[title=cardsize]").attr("href", "css/bigcards.css");
}*/

    sendAction('changeTheme', currentTheme);


    return false;
  });


  $('#show-extra-buttons').click(function() {
    $('#show-extra-buttons').hide();
    $('.extra-buttons').fadeIn(200);
  });

  $('#import-json').click(function() {
    $('.import-form').fadeIn(200, function () {
      $('#cancel-import-file').click(function () {
        $('.import-form').hide();
      });
    });
  });



  $('#icon-col').hover(
    function () {
      $('.col-icon').fadeIn(10);
    },
    function () {
      $('.col-icon').fadeOut(150);
    }
  );

  $('#add-col').click(
    function () {
      createColumn('New');
      return false;
    }
  );

  $('#delete-col').click(
    function () {
      deleteColumn();
      return false;
    }
  );


  // $('#cog-button').click( function(){
  // 	$('#config-dropdown').fadeToggle();
  // } );

  // $('#config-dropdown').hover(
  // 	function(){ /*$('#config-dropdown').fadeIn()*/ },
  // 	function(){ $('#config-dropdown').fadeOut() }
  // );
  //

  var user_name = getCookie('scrumscrum-username');


  $("#yourname-input").focus(function () {
    if ($(this).val() == 'unknown') {
      $(this).val("");
    }

    $(this).addClass('focused');

  });

  $("#yourname-input").blur(function () {
    if ($(this).val() === "") {
      $(this).val('unknown');
    }
    $(this).removeClass('focused');

    setName($(this).val());
  });

  $("#yourname-input").val(user_name);
  $("#yourname-input").blur();

  $("#yourname-li").hide();

  $("#yourname-input").keypress(function (e) {
    code = (e.keyCode ? e.keyCode : e.which);
    if (code == 10 || code == 13) {
      $(this).blur();
    }
  });


  $(".sticker").draggable({
    revert: true,
    zIndex: 1000
  });


  $(".board-outline").resizable({
    ghost: false,
    minWidth: 700,
    minHeight: 400,
    maxWidth: 3200,
    maxHeight: 1800,
  });

  //A new scope for precalculating
  (function () {
    var offsets;

    $(".board-outline").bind("resizestart", function () {
      offsets = calcCardOffset();
    });
    $(".board-outline").bind("resize", function (event, ui) {
      adjustCard(offsets, false);
    });
    $(".board-outline").bind("resizestop", function (event, ui) {
      if ($(ui.element).hasClass('board-outline')) {
        boardResizeHappened(event, ui);
      } else {
        columnResizeHappened(event, ui);
      }
      adjustCard(offsets, true);
    });
  })();

  $('#export-txt').click(function () {
    socket.json.send({
      action: 'exportTxt',
      data: ($('.col').length !== 0) ? $('.col').css('width').replace('px', '') : null
    });
  })

  $('#export-csv').click(function () {
    socket.json.send({
      action: 'exportCsv',
      data: ($('.col').length !== 0) ? $('.col').css('width').replace('px', '') : null
    });
  })

  $('#export-json').click(function () {
    socket.json.send({
      action: 'exportJson',
      data: {
        width: $('.board-outline').css('width').replace('px', ''),
        height: $('.board-outline').css('height').replace('px', '')
      }
    });
  })

  $('#import-file').click(function (evt) {
    evt.stopPropagation();
    evt.preventDefault();

    var f = $('#import-input').get(0).files[0];
    var fr = new FileReader();
    fr.onloadend = function () {
      var text = fr.result;
      socket.json.send({
        action: 'importJson',
        data: JSON.parse(text)
      });
    };
    fr.readAsBinaryString(f);
  })

  $('#create-revision').click(function () {
    socket.json.send({
      action: 'createRevision',
      data: {
        width: $('.board-outline').css('width').replace('px', ''),
        height: $('.board-outline').css('height').replace('px', '')
      }
    });
  })
});
