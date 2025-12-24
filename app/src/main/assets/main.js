class Item {
  constructor (name, password) {
    this.name = name;
    this.simpleAlphabet = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    this.alphabet = Item.simpleAlphabet + "!#?@-*()[]\/+%:;&{},.<>_";
    this.setOrUpdate(password);
  }
  setOrUpdate (password) {
    if (password) {
      this.set(password);
    } else {
      this.update();
    }
  }
  update (simple) {
    if (simple === null || simple === undefined) {
      simple = asafonov.settings.simpleByDefault;
    }
    const alphabet = simple ? "simpleAlphabet" : "alphabet";
    const alphabetLength = this[alphabet].length;
    const passwordLength = asafonov.settings.passwordMinLength + parseInt((asafonov.settings.passwordMaxLength - asafonov.settings.passwordMinLength + 1) * Math.random(), 10);
    let password = '';
    for (let i = 0; i < passwordLength; ++i) {
      password += this[alphabet][parseInt(Math.random() * alphabetLength, 10)];
    }
    this.set(password);
  }
  set (password) {
    this.password = password;
    asafonov.messageBus.send(asafonov.events.ITEM_UPDATED, {item: this});
  }
  get() {
    return this.password;
  }
  destroy() {
  }
}
class List {
  constructor() {
    this.items = {}
    const passwords = JSON.parse(window.localStorage.getItem('passwords')) || {}
    const keys = Object.keys(passwords).sort()
    for (let i = 0; i < keys.length; ++i) {
      const key = keys[i]
      this.items[key] = new Item(key, passwords[key])
    }
    asafonov.messageBus.subscribe(asafonov.events.ITEM_UPDATED, this, 'onItemUpdated')
    asafonov.messageBus.subscribe(asafonov.events.EDIT_DELETED, this, 'onEditDeleted')
    asafonov.messageBus.subscribe(asafonov.events.EDIT_SAVED, this, 'onEditSaved')
  }
  onItemUpdated (data) {
    this.save()
  }
  onEditDeleted (data) {
    const name = data.item.name
    if (this.items[name]) {
      this.deleteItem(name)
      this.save()
      asafonov.messageBus.send(asafonov.events.LIST_UPDATED)
    }
  }
  search (query) {
    return Object.keys(this.items).filter(i => i.toLowerCase().indexOf(query.toLowerCase()) > -1)
  }
  onEditSaved (data) {
    if (data.item && data.item.name == data.name) {
      this.items[data.name].setOrUpdate(data.password)
    } else {
      data.item && this.deleteItem(data.item.name)
      this.items[data.name] = new Item(data.name, data.password)
      this.save()
      asafonov.messageBus.send(asafonov.events.LIST_UPDATED)
    }
  }
  deleteItem (name) {
    this.items[name].destroy()
    this.items[name] = null
    delete this.items[name]
  }
  updateItem (name, password) {
    if (this.items[name]) {
      this.items[name].set(password)
    } else {
      this.items[name] = new Item(name, password)
      asafonov.messageBus.send(asafonov.events.LIST_UPDATED)
    }
    this.save()
  }
  load (data) {
    for (let i in this.items) {
      this.deleteItem(i)
    }
    for (let i in data) {
      this.updateItem(i, data[i])
    }
  }
  asString() {
    let passwords = {}
    for (let i in this.items) {
      passwords[i] = this.items[i].get()
    }
    return JSON.stringify(passwords)
  }
  save() {
    window.localStorage.setItem('passwords', this.asString())
  }
  destroy() {
    asafonov.messageBus.unsubscribe(asafonov.events.ITEM_UPDATED, this, 'onItemUpdated')
    asafonov.messageBus.unsubscribe(asafonov.events.EDIT_DELETED, this, 'onEditDeleted')
    asafonov.messageBus.unsubscribe(asafonov.events.EDIT_SAVED, this, 'onEditSaved')
    this.items = null
  }
}
class MessageBus {
  constructor() {
    this.subscribers = {};
  }
  send (type, data) {
    if (this.subscribers[type] !== null && this.subscribers[type] !== undefined) {
      for (var i = 0; i < this.subscribers[type].length; ++i) {
        this.subscribers[type][i]['object'][this.subscribers[type][i]['func']](data);
      }
    }
  }
  subscribe (type, object, func) {
    if (this.subscribers[type] === null || this.subscribers[type] === undefined) {
      this.subscribers[type] = [];
    }
    this.subscribers[type].push({
      object: object,
      func: func
    });
  }
  unsubscribe (type, object, func) {
    for (var i = 0; i < this.subscribers[type].length; ++i) {
      if (this.subscribers[type][i].object === object && this.subscribers[type][i].func === func) {
        this.subscribers[type].slice(i, 1);
        break;
      }
    }
  }
  unsubsribeType (type) {
    delete this.subscribers[type];
  }
  destroy() {
    for (type in this.subscribers) {
      this.unsubsribeType(type);
    }
    this.subscribers = null;
  }
}
class Swipe {
  constructor (element, minMovement) {
    this.x = null;
    this.y = null;
    this.xn = null;
    this.yn = null;
    this.minMovement = minMovement || 100;
    this.element = element;
    this.onTouchStartProxy = this.onTouchStart.bind(this);
    this.onTouchMoveProxy = this.onTouchMove.bind(this);
    this.onTouchEndProxy = this.onTouchEnd.bind(this);
    this.addEventListeners();
  }
  isMinimalMovement() {
    const xdiff = this.x - this.xn;
    const ydiff = this.y - this.yn;
    return Math.abs(xdiff) > this.minMovement || Math.abs(ydiff) > this.minMovement;
  }
  onTouchStart (event) {
    this.x = event.touches[0].clientX;
    this.y = event.touches[0].clientY;
    this.xn = this.x;
    this.yn = this.y;
    this.swipeStarted = false;
  }
  onTouchMove (event) {
    this.xn = event.touches[0].clientX;
    this.yn = event.touches[0].clientY;
    if (! this.swipeStarted && this.isMinimalMovement()) {
      this.onSwipeStart();
      this.swipeStarted = true;
    }
    this.swipeStarted && this.onSwipeMove();
  }
  onTouchEnd (event) {
    if (! this.isMinimalMovement()) {
      return ;
    }
    this.onSwipeEnd();
    const xdiff = this.x - this.xn;
    const ydiff = this.y - this.yn;
    if (Math.abs(xdiff) > Math.abs(ydiff)) {
      this[xdiff < 0 ? 'onRight' : 'onLeft']();
    } else {
      this[ydiff < 0 ? 'onDown' : 'onUp']();
    }
  }
  onLeft (f) {
    f && (this.onLeft = f);
    return this;
  }
  onRight (f) {
    f && (this.onRight = f);
    return this;
  }
  onUp (f) {
    f && (this.onUp = f);
    return this;
  }
  onDown (f) {
    f && (this.onDown = f);
    return this;
  }
  onSwipeStart (f) {
    f && (this.onSwipeStart = f);
    return this;
  }
  onSwipeMove (f) {
    f && (this.onSwipeMove = f);
    return this;
  }
  onSwipeEnd (f) {
    f && (this.onSwipeEnd = f);
    return this;
  }
  manageEventListeners (remove) {
    const action = remove ? 'removeEventListener' : 'addEventListener';
    this.element[action]('touchstart', this.onTouchStartProxy);
    this.element[action]('touchmove', this.onTouchMoveProxy);
    this.element[action]('touchend', this.onTouchEndProxy);
  }
  addEventListeners() {
    this.manageEventListeners();
  }
  removeEventListeners() {
    this.manageEventListeners(true);
  }
  destroy() {
    this.x = null;
    this.y = null;
    this.xn = null;
    this.yn = null;
    this.minMovement = null;
    this.removeEventListeners();
    this.element = null;
  }
}
class BackupView {
  constructor (list) {
    this.element = document.querySelector('.backup')
    this.list = list
    this.qrCodeElement = this.createQRCodeElement()
    this.qrCode = this.createQRCode()
    this.scannerElement = this.createScannerElement()
    this.stream = null
    this.scanning = false
    this.rafId = null
    this.onPopupProxy = this.onPopup.bind(this)
    this.onExportProxy = this.onExport.bind(this)
    this.onImportProxy = this.onImport.bind(this)
    this.scanLoopProxy = this.scanLoop.bind(this)
    this.manageEventListeners()
  }
  manageEventListeners (remove) {
    const action = remove ? 'removeEventListener' : 'addEventListener'
    this.element[action]('click', this.onPopupProxy)
    this.element.querySelector('.file_up')[action]('click', this.onExportProxy)
    this.element.querySelector('.file_down')[action]('click', this.onImportProxy)
  }
  onPopup() {
    this.element.classList.add('open')
  }
  createQRCode() {
    const size = Math.min(document.documentElement.clientWidth, document.documentElement.clientHeight) * 0.96
    return new QRCode(this.qrCodeElement.querySelector('div'), {width: size, height: size})
  }
  createQRCodeElement() {
    const div = document.createElement('div')
    const w = document.documentElement.clientWidth
    const h = document.documentElement.clientHeight
    const size = Math.min(w, h)
    div.style.position = 'fixed'
    div.style.top = '0px'
    div.style.left = '0px'
    div.style.width = `${w}px`
    div.style.height = `${h}px`
    div.style.display = 'none'
    div.style.zIndex = '999'
    div.className = 'back_color'
    div.style.justifyContent = 'center'
    div.style.alignItems = 'center'
    div.style.flexDirection = 'column'
    document.body.appendChild(div)
    const qrDiv = document.createElement('div')
    qrDiv.style.width = `${size}px`
    qrDiv.style.height = `${size}px`
    qrDiv.style.justifyContent = 'center'
    qrDiv.style.alignItems = 'center'
    qrDiv.style.display = 'flex'
    qrDiv.style.backgroundColor = '#ffffff'
    div.appendChild(qrDiv)
    const button = document.createElement('div')
    button.innerHTML = 'Close'
    button.style.marginTop = '20px'
    button.addEventListener('click', () => {
      div.style.display = 'none'
    })
    div.appendChild(button)
    return div
  }
  createScannerElement() {
    const div = document.createElement('div')
    const w = document.documentElement.clientWidth
    const h = document.documentElement.clientHeight
    div.style.position = 'fixed'
    div.style.top = '0px'
    div.style.left = '0px'
    div.style.width = `${w}px`
    div.style.height = `${h}px`
    div.style.display = 'none'
    div.style.zIndex = '999'
    div.className = 'back_color'
    div.style.justifyContent = 'center'
    div.style.alignItems = 'center'
    div.style.flexDirection = 'column'
    const video = document.createElement('video')
    video.setAttribute('autoplay', true)
    video.setAttribute('playsinline', true)
    div.appendChild(video)
    const canvas = document.createElement('canvas')
    canvas.setAttribute('hidden', true)
    div.appendChild(canvas)
    document.body.appendChild(div)
    return div
  }
  onExport() {
    this.qrCodeElement.style.display = 'flex'
    this.qrCode.makeCode(this.list.asString())
    this.hidePopup()
  }
  async startCamera() {
    try {
      const video = this.scannerElement.querySelector('video')
      this.stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: 'environment'}})
      video.srcObject = this.stream
      this.scanning = true
      this.scanLoop()
    } catch (e) {
      alert(e.message)
    }
  }
  stopCamera() {
    this.scanning = false
    const video = this.scannerElement.querySelector('video')
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    if (this.stream) {
      video.srcObject = null
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }
    video.pause()
  }
  scanLoop() {
    if (! this.scanning) return
    const video = this.scannerElement.querySelector('video')
    const canvas = this.scannerElement.querySelector('canvas')
    const ctx = canvas.getContext('2d')
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height)
      if (code) {
        this.stopCamera()
        this.scannerElement.style.display = 'none'
        const data = JSON.parse(code.data)
        this.list.load(data)
        return
      }
    }
    this.rafId = requestAnimationFrame(this.scanLoopProxy)
  }
  onImport() {
    this.scannerElement.style.display = 'flex'
    this.hidePopup()
    this.startCamera()
  }
  hidePopup() {
    this.element.classList.remove('open')
  }
  destroy() {
    this.manageEventListeners(true)
    this.element = null
    this.a = null
    this.fileInput = null
    this.list = null
  }
}
class ItemView {
  constructor() {
    this.element = document.querySelector('.editItem');
    this.cancelButton = document.querySelector('.cancel');
    this.saveButton = this.element.querySelector('.save');
    this.deleteButton = this.element.querySelector('.delete');
    this.newButton = document.querySelector('.new_item');
    this.onCancelProxy = this.onCancel.bind(this);
    this.onDeleteProxy = this.onDelete.bind(this);
    this.onSaveProxy = this.onSave.bind(this);
    this.onNewProxy = this.onNew.bind(this);
    this.cancelButton.addEventListener('click', this.onCancelProxy);
    this.saveButton.addEventListener('click', this.onSaveProxy);
    this.deleteButton.addEventListener('click', this.onDeleteProxy);
    this.newButton.addEventListener('click', this.onNewProxy);
    asafonov.messageBus.subscribe(asafonov.events.EDIT_STARTED, this, 'onEditStarted');
  }
  show() {
    this.render();
    this.element.classList.remove('hidden');
    this.cancelButton.classList.remove('hidden');
    document.querySelector('.new_item').classList.add('hidden');
    document.querySelector('.new_item_ico').classList.add('hidden');
    asafonov.messageBus.send(asafonov.events.POPUP_SHOW);
  }
  hide() {
    this.element.classList.add('hidden');
    this.cancelButton.classList.add('hidden');
    document.querySelector('.new_item').classList.remove('hidden');
    document.querySelector('.new_item_ico').classList.remove('hidden');
    asafonov.messageBus.send(asafonov.events.POPUP_HIDE);
  }
  render () {
    this.element.querySelector('.name').innerHTML = (this.model ? 'Edit' : 'Add') + ' Spass Item';
    this.element.querySelector('input[name=item_name]').value = this.model ? this.model.name : '';
    this.deleteButton.classList[this.model ? 'remove' : 'add']('hidden');
  }
  onEditStarted (data) {
    this.model = data.item;
    this.show();
  }
  onCancel() {
    this.hide();
    asafonov.messageBus.send(asafonov.events.EDIT_CANCELLED);
  }
  onDelete() {
    this.hide();
    asafonov.messageBus.send(asafonov.events.EDIT_DELETED, {item: this.model});
  }
  onSave() {
    const genpass = this.element.querySelector('#genpass').checked;
    const name = this.element.querySelector('input[name=item_name]');
    const pass = this.element.querySelector('input[name=item_man_pass]');
    name.classList.remove('error');
    pass.classList.remove('error');
    if (name.value == '') {
      name.classList.add('error');
      return;
    }
    if (! genpass && pass.value == '') {
      pass.classList.add('error');
      return;
    }
    this.hide();
    asafonov.messageBus.send(asafonov.events.EDIT_SAVED, {
      item: this.model,
      name: name.value,
      password: genpass ? '' : pass.value
    });
  }
  onNew() {
    asafonov.messageBus.send(asafonov.events.EDIT_STARTED, {});
  }
  destroy() {
    this.cancelButton.removeEventListener('click', this.hideProxy);
    this.saveButton.removeEventListener('click', this.onSaveProxy);
    this.deleteButton.removeEventListener('click', this.onDeleteProxy);
    this.element = null;
    this.cancelButton = null;
    this.deleteButton = null;
    this.saveButton = null;
    this.newButton = null;
    asafonov.messageBus.unsubscribe(asafonov.events.EDIT_STARTED, this, 'onEditStarted');
  }
}
class ItemListView {
  constructor (model) {
    this.template = document.querySelector('.templates .itemlist').innerHTML;
    this.model = model;
    this.element = document.createElement('div');
    this.element.className = 'item';
    this.onClickProxy = this.onClick.bind(this);
    this.onCopyProxy = this.onCopy.bind(this);
    this.onGenerateProxy = this.onGenerate.bind(this);
    this.onEditProxy = this.onEdit.bind(this);
    this.onSwipeStartProxy = this.onSwipeStart.bind(this);
    this.onSwipeEndProxy = this.onSwipeEnd.bind(this);
    this.hideAllDonesProxy = this.hideAllDones.bind(this);
    this.showPassProxy = this.showPass.bind(this);
    this.hidePassProxy = this.hidePass.bind(this);
    this.swiper = new Swipe(this.element);
    this.swiper.onLeft(this.showPassProxy);
    this.swiper.onRight(this.hidePassProxy);
    this.swiper.onSwipeStart(this.onSwipeStartProxy);
    this.swiper.onSwipeEnd(this.onSwipeEndProxy);
  }
  manageEventListeners (remove) {
    const action = remove ? 'removeEventListener' : 'addEventListener';
    this.element[action]('click', this.onClickProxy);
    this.element.querySelector('.copy')[action]('click', this.onCopyProxy);
    this.element.querySelector('.generate')[action]('click', this.onGenerateProxy);
    this.element.querySelector('.edit')[action]('click', this.onEditProxy);
  }
  render() {
    this.element.innerHTML = this.template.replace(/{name}/g, this.model.name).replace(/{value}/g, this.model.get());
    this.manageEventListeners();
    return this.element;
  }
  onSwipeStart() {
    const name = this.element.querySelector('.name');
    name.classList.remove('sweep');
    name.classList.add('transparent');
  }
  onSwipeEnd() {
    const name = this.element.querySelector('.name');
    name.classList.remove('transparent');
    name.classList.add('sweep');
    setTimeout(function() {name.classList.remove('sweep')}, 1000);
  }
  showPass() {
    this.element.querySelector('.name').innerHTML = this.model.get();
  }
  hidePass() {
    this.element.querySelector('.name').innerHTML = this.model.name;
  }
  hide() {
    this.element.classList.add('hidden');
  }
  show() {
    this.element.classList.remove('hidden');
  }
  hideAllActions() {
    const actions = document.querySelectorAll('.open');
    for (let i = 0; i < actions.length; ++i) {
      actions[i].classList.remove('open');
    }
  }
  hideAllDones() {
    const dones = this.element.querySelectorAll('.true');
    for (let i = 0; i < dones.length; ++i) {
      dones[i].classList.remove('true');
    }
  }
  copyPasword() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(this.model.get()).then(() => {
        console.log("success");
      }).catch((e)=> {
        console.log(e);
      });
    } else { //Apple=Shit
      const input = document.createElement('input')
      input.contentEditable = true
      input.readOnly = false
      input.value = this.model.get()
      this.element.appendChild(input)
      const range = document.createRange()
      range.selectNodeContents(input)
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
      input.setSelectionRange(0, 99)
      document.execCommand('copy')
      this.element.removeChild(input)
    }
    try {
      if (NativeAndroid !== null && NativeAndroid !== undefined) {
        NativeAndroid.copyToClipboard(this.model.get());
      }
    } catch (e) {
    }
  }
  onCopy() {
    this.copyPasword();
    this.element.querySelector('.copy .done').classList.add('true');
    setTimeout(this.hideAllDonesProxy, 2000);
  }
  onGenerate() {
    this.model.update();
    this.element.querySelector('.generate .done').classList.add('true');
    this.hidePass();
    this.copyPasword();
    setTimeout(this.hideAllDonesProxy, 2000);
  }
  onEdit() {
    asafonov.messageBus.send(asafonov.events.EDIT_STARTED, {item: this.model});
  }
  onClick (event) {
    this.hideAllActions();
    this.element.classList.add('open');
  }
  destroy() {
    this.manageEventListeners(true);
    this.swiper.destroy();
    this.swiper = null;
    this.template = null;
    this.model = null;
    this.element = null;
  }
}
class ListView {
  constructor (model) {
    this.model = model;
    this.views = {};
    this.element = document.querySelector('.items');
    this.searchInput = document.querySelector('.search input');
    this.searchProxy = this.search.bind(this);
    this.manageEventListeners();
  }
  manageEventListeners (remove) {
    const messageBusAction = remove ? 'unsubscribe' : 'subscribe';
    const DOMAction = remove ? 'removeEventListener' : 'addEventListener';
    asafonov.messageBus[messageBusAction](asafonov.events.LIST_UPDATED, this, 'render');
    asafonov.messageBus[messageBusAction](asafonov.events.POPUP_SHOW, this, 'hide');
    asafonov.messageBus[messageBusAction](asafonov.events.POPUP_HIDE, this, 'show');
    this.searchInput[DOMAction]('focus', (e) => e.currentTarget.value = '');
    this.searchInput[DOMAction]('input', this.searchProxy);
  }
  render() {
    this.element.innerHTML = '';
    for (let i in this.model.items) {
      this.views[i] || (this.views[i] = new ItemListView(this.model.items[i]));
      this.element.appendChild(this.views[i].render());
    }
    this.show();
  }
  show() {
    this.element.classList.remove('hidden');
  }
  hide() {
    this.element.classList.add('hidden');
  }
  search() {
    const query = this.searchInput.value;
    for (let i in this.model.items) {
      this.views[i].hide();
    }
    for (let i of this.model.search(query)) {
      this.views[i].show();
    }
  }
  destroy() {
    for (let i in this.views) {
      this.views.destroy();
      this.views[i] = null;
    }
    this.views = null;
    this.model = null;
    this.manageEventListeners(true);
    this.searchInput = null;
    this.element = null;
  }
}
window.asafonov = {}
window.asafonov.messageBus = new MessageBus()
window.asafonov.events = {
  ITEM_UPDATED: 'itemUpdated',
  ITEM_ADDED: 'itemAdded',
  ITEM_DELETED: 'itemDeleted',
  LIST_UPDATED: 'listUpdated',
  EDIT_STARTED: 'editStarted',
  EDIT_CANCELLED: 'editCancelled',
  EDIT_SAVED: 'editSaved',
  EDIT_DELETED: 'editDeleted',
  POPUP_SHOW: 'popupShow',
  POPUP_HIDE: 'popupHide'
}
window.asafonov.settings = {
  passwordMinLength: 12,
  passwordMaxLength: 24,
  simpleByDefault: true
}
window.onerror = (msg, url, line) => {
  alert(`${msg} on line ${line}`)
}
document.addEventListener("DOMContentLoaded", function(event) {
  const list = new List();
  const listView = new ListView(list);
  listView.render();
  const backupView = new BackupView(list);
  const itemView = new ItemView();
});
