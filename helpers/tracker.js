import * as vscode from 'vscode';

class Tracker {
  constructor(storage) {
    this.storage = storage;
    this.isTracking = false;
    this.lastActivity = null;
    this.currentFile = null;
    this.disposables = [];
    this.idleThreshold = 5 * 60 * 1000; // 5 minutes in milliseconds
    this.idleCheckInterval = 30 * 1000; // Check every 30 seconds
    this.idleTimer = null;
  }

  startTracking() {
    if (this.isTracking) return;

    this.isTracking = true;
    this.lastActivity = new Date();

    // Track when text documents are changed
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(this._onActivity.bind(this))
    );

    // Track when the active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(this._onEditorChange.bind(this))
    );

    // Initialize with current editor
    if (vscode.window.activeTextEditor) {
      this._onEditorChange(vscode.window.activeTextEditor);
    }

    // Start idle detection
    this.idleTimer = setInterval(this._checkIdle.bind(this), this.idleCheckInterval);
  }

  stopTracking() {
    if (!this.isTracking) return;

    this.isTracking = false;

    // Dispose of all event listeners
    this.disposables.forEach(disposable => disposable.dispose());
    this.disposables = [];

    // Clear idle timer
    if (this.idleTimer) {
      clearInterval(this.idleTimer);
      this.idleTimer = null;
    }
  }

  _onEditorChange(editor) {
    if (!editor) {
      this.currentFile = null;
      return;
    }

    const fileName = editor.document.fileName;
    const fileExtension = fileName.split('.').pop();

    this.currentFile = {
      name: fileName,
      language: editor.document.languageId,
      extension: fileExtension
    };

    this._onActivity();
  }

  _onActivity() {
    const now = new Date();

    if (this.lastActivity) {
      const timeDiff = now - this.lastActivity;

      // Only count if not idle and if there's a current file
      if (timeDiff < this.idleThreshold && this.currentFile) {
        // Round to nearest second
        const seconds = Math.floor(timeDiff / 1000);

        if (seconds > 0) {
          this.storage.recordActivity(
            seconds,
            this.currentFile.language || 'unknown',
            this.currentFile.extension || 'unknown',
            this.currentFile.name || 'unknown'
          );
        }
      }
    }

    this.lastActivity = now;
  }

  _checkIdle() {
    if (!this.lastActivity) return;

    const now = new Date();
    const timeSinceLastActivity = now - this.lastActivity;

    if (timeSinceLastActivity >= this.idleThreshold) {
      // Considered idle, update last activity without recording time
      this.lastActivity = now;
    }
  }
}

export default Tracker;
