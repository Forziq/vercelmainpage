// Edible Images homepage concept: mobile menu and design-your-own preview.
// Nothing here talks to a server. "Add to basket" is visual only.
(function () {
  var $ = function (selector) { return document.querySelector(selector); };
  var $$ = function (selector) { return Array.prototype.slice.call(document.querySelectorAll(selector)); };

  // Mobile menu
  var menuButton = $('.menu-btn');
  var menu = $('#mobile-menu');
  function setMenu(open) {
    menu.hidden = !open;
    menuButton.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  menuButton.addEventListener('click', function () { setMenu(menu.hidden); });
  $$('#mobile-menu a').forEach(function (link) {
    link.addEventListener('click', function () { setMenu(false); });
  });

  // Design-your-own preview
  var PER_PAGE = { 2: 12, 4: 2, 6: 1, 8: 1 };
  var PAGE_WIDTH_INCHES = 8.27;
  var state = { name: 'Aoife', message: 'Happy 7th birthday', shape: 'circle', size: 4, border: 'Pink', borderHex: '#F06AA8' };

  var mock = $('.t-mock');
  var nameInput = $('#t-name');
  var messageInput = $('#t-msg');
  var fileInput = $('#t-file');
  var photo = $('.t-photo');
  var uploadLabel = $('label.upload span');
  var errorText = $('#t-file-error');
  var mini = $('.mini');
  var sizeNote = $('.sheet-note span:last-child');

  function press(group, button) {
    $$(group + ' button').forEach(function (b) {
      var on = b === button;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function render() {
    var count = PER_PAGE[state.size];
    var rectangle = state.shape === 'rectangle';
    var widthPct = state.size / PAGE_WIDTH_INCHES * 100;
    var cellWidth = state.size === 2 ? 24 : widthPct * 0.9;
    var label = state.shape.charAt(0).toUpperCase() + state.shape.slice(1);
    var dimensions = rectangle && state.size === 8 ? '8" x 10.5"' : state.size + '"';

    mock.className = 't-mock t-' + state.shape;
    mock.style.borderColor = state.borderHex;
    mock.setAttribute('aria-label', 'Preview of a ' + state.size + ' inch ' + state.shape + ' topper for ' + (state.name || 'your cake') + ' with a ' + state.border.toLowerCase() + ' border');
    $('.t-name').textContent = state.name;
    $('.t-msg').textContent = state.message;
    sizeNote.textContent = label + ' ' + dimensions + ': ' + count + (count === 1 ? ' image' : ' images') + ' per page';

    mini.textContent = '';
    for (var i = 0; i < count; i++) {
      var cell = document.createElement('i');
      cell.style.width = cellWidth.toFixed(1) + '%';
      cell.style.aspectRatio = rectangle ? '8 / 10.5' : '1';
      cell.style.borderRadius = state.shape === 'circle' ? '50%' : '1px';
      mini.appendChild(cell);
    }
  }

  nameInput.addEventListener('input', function () { state.name = nameInput.value; render(); });
  messageInput.addEventListener('input', function () { state.message = messageInput.value; render(); });

  $$('[aria-labelledby="lab-shape"] button').forEach(function (button) {
    button.addEventListener('click', function () {
      state.shape = button.textContent.trim().toLowerCase();
      press('[aria-labelledby="lab-shape"]', button);
      render();
    });
  });

  $$('[aria-labelledby="lab-size"] button').forEach(function (button) {
    button.addEventListener('click', function () {
      state.size = parseInt(button.textContent, 10);
      press('[aria-labelledby="lab-size"]', button);
      render();
    });
  });

  $$('[aria-labelledby="lab-border"] button').forEach(function (button) {
    button.addEventListener('click', function () {
      state.border = button.getAttribute('aria-label');
      state.borderHex = button.querySelector('i').style.backgroundColor;
      press('[aria-labelledby="lab-border"]', button);
      render();
    });
  });

  fileInput.addEventListener('change', function () {
    var file = fileInput.files && fileInput.files[0];
    if (!file) return;
    if (!/\.(jpe?g|gif|png)$/i.test(file.name)) {
      fileInput.value = '';
      errorText.textContent = "That file type won't work. Upload a JPG, JPEG, GIF or PNG.";
      errorText.hidden = false;
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var image = document.createElement('img');
      image.src = reader.result;
      image.alt = '';
      photo.textContent = '';
      photo.appendChild(image);
      uploadLabel.textContent = 'Change image (' + file.name + ')';
      errorText.hidden = true;
    };
    reader.readAsDataURL(file);
  });

  $('form.panel').addEventListener('submit', function (event) { event.preventDefault(); });
  render();
})();
