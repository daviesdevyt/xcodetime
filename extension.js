// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import Storage from "./helpers/storage.js"
import Tracker from "./helpers/tracker.js"

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */

let statusBarItem;
let tracker;
let storage;

export function activate(context) {
	console.log('CodeTime Tracker is now active!');

	// Initialize storage

	storage = new Storage(context.globalStoragePath);
	// Initialize tracker
	tracker = new Tracker(storage);
	tracker.startTracking();

	// Create status bar item
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.command = 'codetime-tracker.showStats';
	context.subscriptions.push(statusBarItem);
	updateStatusBar();
	const updateStatusCommand = vscode.commands.registerCommand('xcodetime.updateTime', updateStatusBar);
	context.subscriptions.push(updateStatusCommand);

	// Update status bar every minute
	const statusUpdateInterval = setInterval(updateStatusBar, 60000);
	context.subscriptions.push({ dispose: () => clearInterval(statusUpdateInterval) });
	updateStatusBar();
}

// This method is called when your extension is deactivated
export function deactivate() {
	if (tracker) {
		tracker.stopTracking();
	}
}



function updateStatusBar() {
	const todayStats = storage.getTodayStats();
	const hours = Math.floor(todayStats.totalSeconds / 3600);
	const minutes = Math.floor((todayStats.totalSeconds % 3600) / 60);

	statusBarItem.text = `$(clock) ${hours}h ${minutes}m`;
	statusBarItem.tooltip = 'Time coded today - Click to view stats';
	statusBarItem.show();
}