'use strict';

var Selection = require('../selection');
var Toolbar = require('../toolbars/toolbar');
var Button = require('../toolbars/button');
var I18n = require('../i18n');
var Figure = require('../figure');
var Layout = require('../layout');
var Utils = require('../utils');
var Loader = require('../loader');
var EmbeddedComponent = require('./embeddedComponent');
var GiphyComponent = require('./giphyComponent');


/**
 * LayoutingExtension extension for the editor.
 *   Adds an extendable toolbar for components to add buttons to.
 */
var LayoutingExtension = function () {

  /**
   * The editor this toolbelt belongs to.
   * @type {Editor}
   */
  this.editor = null;

  /**
   * The layouting toolbar.
   * @type {Toolbar}
   */
  this.toolbar = null;

};
module.exports = LayoutingExtension;


/**
 * Extension class name.
 * @type {string}
 */
LayoutingExtension.CLASS_NAME = 'LayoutingExtension';


/**
 * Initializes the toolbelt extensions.
 * @param  {Editor} editor Editor instance this installed on.
 */
LayoutingExtension.onInstall = function(editor) {
  var toolbeltExtension = new LayoutingExtension();
  toolbeltExtension.init(editor);
};


/**
 * Call to destroy instance and cleanup dom and event listeners.
 */
LayoutingExtension.onDestroy = function() {
  // pass
};


/**
 * Initiates the toolbelt extension.
 * @param  {Editor} editor The editor to initialize the extension for.
 */
LayoutingExtension.prototype.init = function(editor) {
  this.editor = editor;

  // Create a new toolbar for the toolbelt.
  this.toolbar = new Toolbar({
    name: LayoutingExtension.TOOLBAR_NAME,
    classNames: [LayoutingExtension.TOOLBAR_CLASS_NAME],
    rtl: this.editor.rtl
  });

  // TODO(mkhatib): Use Icons for buttons here.
  // Add layouting buttons to the toolbar.
  var buttons = [{
    label: I18n.get('button.layout.single'),
    icon: I18n.get('button.layout.icon.single'),
    name: 'layout-single-column'
  }, {
    label: I18n.get('button.layout.bleed'),
    icon: I18n.get('button.layout.icon.bleed'),
    name: 'layout-bleed'
  }, {
    label: I18n.get('button.layout.staged'),
    icon: I18n.get('button.layout.icon.staged'),
    name: 'layout-staged'
  }, {
    label: I18n.get('button.layout.left'),
    icon: I18n.get('button.layout.icon.left'),
    name: 'layout-float-left'
  }, {
    label: I18n.get('button.layout.right'),
    icon: I18n.get('button.layout.icon.right'),
    name: 'layout-float-right'
  }];

  for (var i = 0; i < buttons.length; i++) {
    var button = new Button({
      label: buttons[i].label,
      name: buttons[i].name,
      icon: buttons[i].icon,
      data: { name: buttons[i].name }
    });
    button.addEventListener(
        'click', this.handleLayoutButtonClick.bind(this));
    this.toolbar.addButton(button);
  }

  // Register the toolbelt toolbar with the editor.
  this.editor.registerToolbar(LayoutingExtension.TOOLBAR_NAME, this.toolbar);

  // Listen to selection changes.
  this.editor.article.selection.addEventListener(
      Selection.Events.SELECTION_CHANGED,
      this.handleSelectionChangedEvent.bind(this));
};


/**
 * LayoutingExtension toolbar name.
 * @type {string}
 */
LayoutingExtension.TOOLBAR_NAME = 'layouting-toolbar';


/**
 * LayoutingExtension toolbar class name.
 * @type {string}
 */
LayoutingExtension.TOOLBAR_CLASS_NAME = 'layouting-toolbar';


/**
 * Handles clicking the insert button to expand the toolbelt.
 */
LayoutingExtension.prototype.handleLayoutButtonClick = function(e) {
  var ops = [];
  var insertLayoutAtIndex;
  var selectedComponent = this.editor.selection.getComponentAtStart();
  var componentClassName = selectedComponent.getComponentClassName();
  var ComponentClass = Loader.load(componentClassName);
  var component;
  var newLayout;

  if (selectedComponent instanceof Figure ||
      selectedComponent instanceof EmbeddedComponent ||
      selectedComponent instanceof GiphyComponent) {
    this.toolbar.setActiveButton(e.detail.target);
    var currentLayout = selectedComponent.section;
    var clickedLayout = e.detail.target.name;
    var componentIndexInLayout = selectedComponent.getIndexInSection();
    var isComponentAtStartOfLayout = componentIndexInLayout === 0;
    var isComponentAtEndOfLayout = (
        componentIndexInLayout === currentLayout.getLength() - 1);
    if (currentLayout.type !== clickedLayout) {
      // If figure is the only element in the layout, just change
      // the layout type.
      if (currentLayout.getLength() === 1) {
        Utils.arrays.extend(ops, currentLayout.getUpdateOps({
          type: clickedLayout
        }));
      }

      // If figure is the first/last element in the layout, create a new
      // layout and append it to the section before/after the current layout
      // with the figure in it.
      else if (isComponentAtStartOfLayout || isComponentAtEndOfLayout) {
        insertLayoutAtIndex = currentLayout.getIndexInSection();
        if (isComponentAtEndOfLayout) {
          insertLayoutAtIndex++;
        }
        newLayout = new Layout({
          type: clickedLayout,
          section: currentLayout.section,
          components: []
        });
        Utils.arrays.extend(ops, newLayout.getInsertOps(insertLayoutAtIndex));
        Utils.arrays.extend(ops, selectedComponent.getDeleteOps());

        component = ComponentClass.fromJSON(selectedComponent.getJSONModel());
        component.section = newLayout;
        Utils.arrays.extend(ops, component.getInsertOps(0));
      }

      // If figure is in the middle of a layout. Split layout in that index.
      // Create a new layout and insert it in the middle.
      else {
        insertLayoutAtIndex = currentLayout.getIndexInSection() + 1;
        newLayout = new Layout({
          type: clickedLayout,
          section: currentLayout.section,
          components: []
        });

        Utils.arrays.extend(
            ops, currentLayout.getSplitOps(componentIndexInLayout));
        Utils.arrays.extend(ops, selectedComponent.getDeleteOps());
        Utils.arrays.extend(ops, newLayout.getInsertOps(insertLayoutAtIndex));

        component = ComponentClass.fromJSON(selectedComponent.getJSONModel());
        component.section = newLayout;
        Utils.arrays.extend(ops, component.getInsertOps(0));
      }

      this.editor.article.transaction(ops);
      this.editor.dispatchEvent(new Event('change'));
    }
  }

  this.handleSelectionChangedEvent();
};


/**
 * Handles selection change event on the editor to hide the toolbelt.
 */
LayoutingExtension.prototype.handleSelectionChangedEvent = function() {
  var selectedComponent = this.editor.selection.getComponentAtStart();
  if ((selectedComponent instanceof Figure && !selectedComponent.isDataUrl) ||
      selectedComponent instanceof EmbeddedComponent ||
      selectedComponent instanceof GiphyComponent) {
    var activeLayout = selectedComponent.section.type;
    var activeLayoutButton = this.toolbar.getButtonByName(activeLayout);
    this.toolbar.setActiveButton(activeLayoutButton);

    this.toolbar.setPositionToTopOf(selectedComponent.dom);
    this.toolbar.setVisible(true);
  } else {
    this.toolbar.setVisible(false);
  }
};


/**
 * Handles new button added to toolbelt to show the insert button.
 */
LayoutingExtension.prototype.handleButtonAdded = function () {
  this.insertButton.setVisible(true);
};
