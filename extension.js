import Clutter from 'gi://Clutter'
import Gio from 'gi://Gio'
import GLib from 'gi://GLib'
import GObject from 'gi://GObject'
import St from 'gi://St'


import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js'


import * as Main from 'resource:///org/gnome/shell/ui/main.js'
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js'
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js'

class KeyboardListMenu extends PanelMenu.Button {
    static {
        GObject.registerClass(this)
    }
    displayEverything = false
    constructor(path) {
        super(0.0, "Keyboard cat defense")

        // add main icon
        let icon = new St.Icon({
            gicon: Gio.icon_new_for_string(path + "/cat.svg"),
            style_class: 'cat-icon'
        })
        this.add_child(icon)

        // even though we remove this item in _updateKeyboardList(), we need to add it
        // if we don't, the dropdown menu won't open at all
        this.menu.addMenuItem(new PopupMenu.PopupMenuItem('List of connected keyboards:'))

        this.menu.connect('open-state-changed', (menu, open) => {
            // when opening for the first time
            if (open && !this.initialized) {
                this._updateKeyboardList()
                this.initialized = true
            }
        })
    }

    /**
     * Used to create the dropdown menu for the extensions
     */
    _updateKeyboardList() {
        this.menu.removeAll()
        let toggleItem = new PopupMenu.PopupSwitchMenuItem('Display every input device', this.displayEverything)
        this.menu.addMenuItem(toggleItem)
        toggleItem.connect('toggled', (item) => {
            this.displayEverything = item.state
            this._updateKeyboardList()
        })

        // Get the list of connected keyboards
        this.menu.addMenuItem(new PopupMenu.PopupMenuItem('List of connected keyboards:'))
        this._getConnectedKeyboards((err, keyboards) => {
            if (err) {
                logError(err)
                return
            }
            if (keyboards.length === 0) {
                let item = new PopupMenu.PopupMenuItem('No keyboards connected')
                item.setSensitive(false)
                this.menu.addMenuItem(item)
                return
            }
            keyboards.forEach((keyboard) => {
                let toggleItem = new PopupMenu.PopupSwitchMenuItem(keyboard.name, true) // Create a toggle button for the keyboard

                this.menu.addMenuItem(toggleItem)

                toggleItem.connect('toggled', (item) => {
                    if (item.state) {
                        this._enableKeyboard(keyboard.id)
                    } else {
                        this._disableKeyboard(keyboard.id)
                    }

                    return Clutter.EVENT_STOP
                })
            })
        })

    }


    /**
     * Used to get the list of connected devices and filter for keyboards
     * @param {function(Error, object)} callback - error and list of keyboards 
     */
    _getConnectedKeyboards(callback) {
        const command = 'xinput list'
        try {
            let proc = Gio.Subprocess.new(
                ['/bin/bash', '-c', command],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            )
            proc.communicate_utf8_async(null, null, (proc, res) => {
                try {
                    let [, stdout, stderr] = proc.communicate_utf8_finish(res)

                    if (!proc.get_successful())
                        callback(new Error(stderr))
                    let keyboards = []
                    let lines = stdout.toString().split('\n')

                    const keyboardIdRegex = /id=(\d+)/

                    // let masterKeyId
                    for (let line of lines) {
                        // get the master keyboard Id
                        // if (line.includes('master keyboard')) {
                        //     // if we detect the master key id
                        //     if (keyboardIdRegex.exec(line)) {
                        //         masterKeyId = keyboardIdRegex.exec(line)[1]
                        //     }
                        // }

                        let parts = line.split('\t')
                        if (!this.displayEverything) {
                            if (!line.includes('slave  keyboard')) {
                                continue
                            }

                            // make sure the name also includes the word keyboard
                            if (!parts[0].includes('keyboard')) {
                                continue
                            }
                        }

                        // get the device ID
                        let keyId = keyboardIdRegex.exec(line)
                        if (keyId) {
                            keyId = keyId[1]

                            // for the keyboard name, trim the white space
                            // and loose the first chars
                            const keyboardName = parts[0].trim().slice(2)
                            keyboards.push({
                                name: keyboardName,
                                id: keyId,
                            })
                        }
                    }
                    callback(null, keyboards)
                }
                catch (e) {
                    callback(e)
                }
            })
        } catch (e) {
            callback(e)
        }
    }

    /**
     * Disables a keyboard
     * @param  {number} keyboardId id of a keyboard device
     */
    _disableKeyboard(keyboardId) {
        let command = `xinput --disable ${keyboardId}`
        let success = GLib.spawn_command_line_async(command)
        if (!success) {
            log(`Error enabling keyboard: ${stderr}`)
        }
        return
    }

    /**
     * Enables a keyboard
     * @param  {number} keyboardId id of a keyboard device
     */
    _enableKeyboard(keyboardId) {
        const command = `xinput --enable ${keyboardId}`
        let success = GLib.spawn_command_line_async(command)
        if (!success) {
            log(`Error enabling keyboard: ${stderr}`)
        }
        return
    }
}


export default class extends Extension {
    enable() {
        this._indicator = new KeyboardListMenu(this.path)
        Main.panel.addToStatusArea('keyboard-list-menu', this._indicator, 0, 'right')
    }

    disable() {
        this._indicator.destroy()
        this._indicator = null
    }
}
