var UndoManager = function () {
  "use strict";

  var undoStack = [];
  var redoStack = [];
  var $undo = $(".undo");
  var $redo = $(".redo");

  var execute = function(action) {
    if (!action || typeof action.command !== "function") {
      return this;
    }
    action.command(action.data);
    return this;
  };

  var enableButtons = function () {
    $undo.prop("disabled",!undoManager.hasUndo());
    $redo.prop("disabled",!undoManager.hasRedo());
  };

  var undoManager = {

    performAction: function (command) {
      redoStack = [];
      undoStack.push(command);
      execute(command.action);
      enableButtons();
    },

    undo: function () {
      var command = undoStack.pop();
      execute(command.undo);
      redoStack.push(command);
      enableButtons();
    },

    redo: function () {
      var command = redoStack.pop();
      undoStack.push(command);
      execute(command.action);
      enableButtons();
    },

    clear: function () {
      undoStack = [];
      redoStack = [];
      enableButtons();
    },

    hasUndo: function () {
      return undoStack.length > 0;
    },

    hasRedo: function () {
      return redoStack.length > 0;
    }

  };

  $undo.click(function(){
    undoManager.undo();
  });

  $redo.click(function(){
    undoManager.redo();
  });

  undoManager.clear();
  return undoManager;

};