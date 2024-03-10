const { St, Gio, GObject, GLib, Shell, Clutter } = imports.gi

const Me = imports.misc.extensionUtils.getCurrentExtension()
const Main = imports.ui.main
const PanelMenu = imports.ui.panelMenu
const PopupMenu = imports.ui.popupMenu

let KeyboardListMenu = GObject.registerClass(
    class KeyboardListMenu extends PanelMenu.Button {
        _init() {
            super._init(0.0, "Keyboard cat defense")

            // add main icon
            let icon = new St.Icon({
                gicon: Gio.icon_new_for_string(Me.path + "/cat.svg"),
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

            this.menu.addMenuItem(new PopupMenu.PopupMenuItem('List of connected keyboards:'))

            // Get the list of connected keyboards
            let keyboards = this._getConnectedKeyboards()

            if (keyboards.length === 0) {
                let item = new PopupMenu.PopupMenuItem('No keyboards connected')
                item.setSensitive(false)
                this.menu.addMenuItem(item)
            } else {
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
            }
        }

        /**
         * Used to get the list of connected devices and filter for keyboards
         * @return {Array} the list of keyboards
         */
        _getConnectedKeyboards() {
            let [success, stdout, stderr] = GLib.spawn_command_line_sync('xinput list')
            if (!success) {
                log(`Error executing xinput list: ${stderr}`)
                return []
            }

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

                if (line.includes('slave  keyboard')) {
                    let parts = line.split('\t')

                    // make sure the name also includes the word keyboard
                    if (!parts[0].includes('keyboard')) {
                        continue
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
            }

            return keyboards
        }

        /**
         * Disables a keyboard
         * @param  {Number} keyboardId
         */
        _disableKeyboard(keyboardId) {
            // Use xinput command to disable the keyboard with the given ID
            let command = `xinput --disable ${keyboardId}`
            let [success, stdout, stderr] = GLib.spawn_command_line_sync(command)

            if (!success) {
                log(`Error deactivating keyboard: ${stderr}`)
            }
        }

        /**
         * Enables a keboard
         * @param  {Number} keyboardId
         */
        _enableKeyboard(keyboardId) {
            // Use xinput command to enable the keyboard with the given ID
            let command = `xinput --enable ${keyboardId}`
            let [success, stdout, stderr] = GLib.spawn_command_line_sync(command)

            if (!success) {
                log(`Error enabling keyboard: ${stderr}`)
            }
        }
    }
)

let KeyboardListExtension = class KeyboardListExtension {
    constructor() {}

    enable() {
        this._indicator = new KeyboardListMenu()
        Main.panel.addToStatusArea('keyboard-list-menu', this._indicator, 0, 'right')
    }

    disable() {
        this._indicator.destroy()
    }
}

function init() {
    return new KeyboardListExtension()
}