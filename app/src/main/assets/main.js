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
    this.items = {};
    const passwords = JSON.parse(window.localStorage.getItem('passwords'));

    for (let i in passwords) {
      this.items[i] = new Item(i, passwords[i]);
    }

    asafonov.messageBus.subscribe(asafonov.events.ITEM_UPDATED, this, 'onItemUpdated');
    asafonov.messageBus.subscribe(asafonov.events.EDIT_DELETED, this, 'onEditDeleted');
    asafonov.messageBus.subscribe(asafonov.events.EDIT_SAVED, this, 'onEditSaved');
  }

  onItemUpdated (data) {
    this.save();
  }

  onEditDeleted (data) {
    const name = data.item.name;

    if (this.items[name]) {
      this.deleteItem(name);
      this.save();
      asafonov.messageBus.send(asafonov.events.LIST_UPDATED);
    }
  }

  onEditSaved (data) {
    if (data.item && data.item.name == data.name) {
      this.items[data.name].setOrUpdate(data.password);
    } else {
      data.item && this.deleteItem(data.item.name);
      this.items[data.name] = new Item(data.name, data.password);
      asafonov.messageBus.send(asafonov.events.LIST_UPDATED);
    }
  }

  deleteItem (name) {
    this.items[name].destroy();
    this.items[name] = null;
    delete this.items[name];
  }

  updateItem (name, password) {
    if (this.items[name]) {
      this.items[name].set(password);
    } else {
      this.items[name] = new Item(name, password);
      asafonov.messageBus.send(asafonov.events.LIST_UPDATED);
    }

    this.save();
  }

  load (data) {
    for (let i in data) {
      this.updateItem(i, data[i]);
    }
  }

  save() {
    let passwords = {};

    for (let i in this.items) {
      passwords[i] = this.items[i].get();
    }

    window.localStorage.setItem('passwords', JSON.stringify(passwords));
  }

  destroy() {
    asafonov.messageBus.unsubscribe(asafonov.events.ITEM_UPDATED, this, 'onItemUpdated');
    asafonov.messageBus.unsubscribe(asafonov.events.EDIT_DELETED, this, 'onEditDeleted');
    asafonov.messageBus.unsubscribe(asafonov.events.EDIT_SAVED, this, 'onEditSaved');
    this.items = null;
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
class BackupView {
  constructor (list) {
    this.element = document.querySelector('.backup');
    this.list = list;
    this.onPopupProxy = this.onPopup.bind(this);
    this.onFileExportProxy = this.onFileExport.bind(this);
    this.onFileImportProxy = this.onFileImport.bind(this);
    this.onFileReadyProxy = this.onFileReady.bind(this);
    this.manageEventListeners();
  }

  manageEventListeners (remove) {
    const action = remove ? 'removeEventListener' : 'addEventListener';
    this.element[action]('click', this.onPopupProxy);
    this.element.querySelector('.file_up')[action]('click', this.onFileExportProxy);
    this.element.querySelector('.file_down')[action]('click', this.onFileImportProxy);
    this.element.querySelector('.file_down input')[action]('change', this.onFileReadyProxy);
  }

  onPopup() {
    this.element.classList.add('open');
  }

  onFileExport() {
  }

  onFileImport() {
    this.element.querySelector('input').click();
  }

  onFileReady (event) {
    if (event.target.files && event.target.files[0]) {
      const reader = new FileReader();
      const _this = this;
      
      reader.addEventListener('load', function (e) {
        _this.list.load(JSON.parse(e.target.result));
      });
      
      reader.readAsBinaryString(event.target.files[0]);
    }   
  }

  hidePopup() {
    this.element.classList.remove('open');
  }

  destroy() {
    this.manageEventListeners(true);
    this.element = null;
    this.list = null;
  }
}
class ItemView {

  constructor() {
    this.element = document.querySelector('.editItem');
    this.cancelButton = document.querySelector('.cancel');
    this.saveButton = this.element.querySelector('.save');
    this.deleteButton = this.element.querySelector('.delete');
    this.newButton = document.querySelector('.new');
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
  }

  hide() {
    this.element.classList.add('hidden');
    this.cancelButton.classList.add('hidden');
    document.querySelector('.new_item').classList.remove('hidden');
    document.querySelector('.new_item_ico').classList.remove('hidden');
  }

  render () {
    this.element.querySelector('.name').innerHTML = (this.model ? 'Edit' : 'Add') + ' Spass Item';
    this.element.querySelector('input[name=item_name]').value = this.model ? this.model.name : '';
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
    this.hideAllDonesProxy = this.hideAllDones.bind(this);
    this.initBuffer();
  }

  initBuffer() {
    this.buffer = document.querySelector('#itemListBuffer');

    if (this.buffer) {
      return ;
    }

    this.buffer = document.createElement('textarea');
    this.buffer.id = 'itemListBuffer';
    this.buffer.style.width = '0px';
    this.buffer.style.height = '0px';
    this.buffer.style.position = 'absolute';
    this.buffer.style.background = 'transparent';
    document.body.insertBefore(this.buffer, document.body.childNodes[0]);
    this.buffer.value = 'itemListBuffer';
    this.buffer.select();
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

  onCopy() {
    this.buffer.value = this.model.get();
    this.buffer.select();
    document.execCommand('copy');
    this.element.querySelector('.copy .done').classList.add('true');
    setTimeout(this.hideAllDonesProxy, 2000);
  }

  onGenerate() {
    this.model.update();
    this.element.querySelector('.generate .done').classList.add('true');
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
    this.template = null;
    this.model = null;
    this.element = null;
    this.buffer = null;
  }
}
class ListView {

  constructor (model) {
    this.model = model;
    this.views = {};
    this.element = document.querySelector('.items');
    asafonov.messageBus.subscribe(asafonov.events.LIST_UPDATED, this, 'render');
    asafonov.messageBus.subscribe(asafonov.events.EDIT_STARTED, this, 'hide');
    asafonov.messageBus.subscribe(asafonov.events.EDIT_CANCELLED, this, 'show');
    asafonov.messageBus.subscribe(asafonov.events.EDIT_SAVED, this, 'show');
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

  destroy() {
    for (let i in this.views) {
      this.views.destroy();
      this.views[i] = null;
    }

    this.views = null;
    this.model = null;
    this.element = null;
    asafonov.messageBus.unsubscribe(asafonov.events.LIST_UPDATED, this, 'render');
    asafonov.messageBus.unsubscribe(asafonov.events.EDIT_STARTED, this, 'hide');
    asafonov.messageBus.unsubscribe(asafonov.events.EDIT_CANCELLED, this, 'show');
    asafonov.messageBus.unsubscribe(asafonov.events.EDIT_SAVED, this, 'show');
  }
}
window.asafonov = {};
window.asafonov.messageBus = new MessageBus();
window.asafonov.events = {
  ITEM_UPDATED: 'itemUpdated',
  ITEM_ADDED: 'itemAdded',
  ITEM_DELETED: 'itemDeleted',
  LIST_UPDATED: 'listUpdated',
  EDIT_STARTED: 'editStarted',
  EDIT_CANCELLED: 'editCancelled',
  EDIT_SAVED: 'editSaved',
  EDIT_DELETED: 'editDeleted',
};
window.asafonov.settings = {
  passwordMinLength: 12,
  passwordMaxLength: 24,
  simpleByDefault: true
};
document.addEventListener("DOMContentLoaded", function(event) {
  const list = new List();
  const listView = new ListView(list);
  listView.render();
  const backupView = new BackupView(list);
  const itemView = new ItemView();
});
