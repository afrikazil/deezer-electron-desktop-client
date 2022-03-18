const electron = require("electron")
const Player = require("mpris-service")
const { dialog } = require('electron')
const fs = require('fs');
const path = require('path');

const iconPath = path.join(__dirname, '', 'icons', '512x512.png');


const {
    app,
    BrowserWindow,
    Tray,
    ipcMain,
    Notification,
    nativeImage,
    Menu
} = electron

let win
let tray
let complete_exit = false
let notification

const init_js = `
if(!window.client_setadresdcsac){
    const electron = require("electron");
    window.ipc = electron.ipcRenderer;
    window.dzPlayer?.trigger = function(action){
        return function(name, job){
            ipc.send("notifs", name)
            return action.call(window.dzPlayer, name, job)
        }
    }(window.dzPlayer?.trigger);
    window.client_setadresdcsac = true
}
`

function initApp(params) {
    // Create window
    // win = new BrowserWindow({ icon: __dirname + "/Icon16x16.png" })
    win = new BrowserWindow({ show: false, width: 1100, height: 800,resizable:false,autoHideMenuBar:true})
    win.loadURL("https://www.deezer.com/ru/",{
        userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36'
    })
    // win.maximize()


    win.once('ready-to-show', () => {
        win.show()
    })
    win.webContents.on('before-input-event', (event, input) => {
        if(input.key==='`')win.hide()
    })
    // win.on("close", event => {
    //     // win.close()        // app.quit();
    //     // win.close();
    //     // show_hide();
    //     // if (!complete_exit) {
    //     //     event.preventDefault()
    //     //     isPlaying(show_hide, exit)
    //     // } else {
    //     //     app.quit()
    //     // }
    // })

    win.setIcon(iconPath)
    win.onbeforeunload = (e) => {
        e.preventDefault()

        console.log('Я не хочу быть закрыт')
        return dialog.showOpenDialog(win,{
            title:'Че, залупа, творишь???',
            buttonLabel:'Хуярить!'
            }
        )
        // e.returnValue = false // идентично `return false`, но в использовании не рекомендуется
    }

    // Handle Events from client
    ipcMain.on("notifs", handleClientNotifs)
    win.webContents.on("did-stop-loading", event => {
        win.webContents.executeJavaScript(init_js)
    })

    // Tray Menu control
    setUpTray()
}
function setUpTray() {
    const image = nativeImage.createFromPath(__dirname + "/icons/64x64.png")
    image.setTemplateImage(true)
    tray = new Tray(image)

    tray.setToolTip("Хуизер")
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Замолчать', type: 'radio' },
        { label: 'Остановить', type: 'radio' },
        { label: 'Следующий', type: 'radio', checked: true },
        { label: 'Предыдущий', type: 'radio' }
    ])

    tray.setContextMenu(contextMenu)
    tray.on("click", () => {
        show_hide()
    })
}

function handleClientNotifs(event, notif) {
    switch (notif) {
        case "audioPlayer_playTracks":
        case "audioPlayer_play":
        case "audioPlayer_pause":
            osNotify(notif)
            break
    }
}

function osNotify(notif) {
    win.webContents.executeJavaScript(
        `[
            dzPlayer.getSongTitle(),
            dzPlayer.getAlbumTitle(),
            dzPlayer.getArtistName(),
            dzPlayer.isPlaying(),
            dzPlayer.getDuration(),
            dzPlayer.getCover(),
            dzPlayer.getCurrentSong().MD5_ORIGIN
        ]`,
        result => {
            let [title, alburm, artist, playing, duration, cover_id, track_id] = result
            const cover = `https://e-cdns-images.dzcdn.net/images/cover/${cover_id}/380x380-000000-80-0-0.jpg`
            playing = notif === "audioPlayer_playTracks" ? true : playing

            updatePlayer({ title, alburm, artist, playing, duration, cover, track_id })

            if (Notification.isSupported()) {
                if (!notification) {
                    notification = new Notification({
                        title: `${title} - ${artist}`,
                        body: `${
                            playing ? "Playing" : "Paused"
                        }, Alburm: ${alburm}`,
                        icon: __dirname + "/16x16.png",
                        silent: true,
                    })
                } else {
                    notification.title = `${title} - ${artist}`
                    notification.body = `${
                        playing ? "Playing" : "Paused"
                    }, Alburm: ${alburm}`
                }
                notification.show()
                notification.on("click", () => {
                    notification.close()
                    win.show()
                })
            }
        }
    )
}

function show_hide(focus) {
    if(win.isVisible() && focus){
        win.focus()
        return
    }else if(win.isVisible()){
        win.hide()
        return
    }
    win.show()
    win.focus()
}

function exit() {
    complete_exit = true
    win.close()
}

function play() {
    win.webContents.executeJavaScript("dzPlayer.control.play()")
}

function pause() {
    win.webContents.executeJavaScript("dzPlayer.control.pause()")
}

function next() {
    win.webContents.executeJavaScript("dzPlayer.control.nextSong()")
}

function prev() {
    win.webContents.executeJavaScript("dzPlayer.control.prevSong()")
}

function isPlaying(playing, paused) {
    win.webContents.executeJavaScript("dzPlayer.isPlaying()", isPlaying => {
        isPlaying ? playing() : paused()
    })
}

app.on("ready", initApp)

if (app.requestSingleInstanceLock()){
    app.on('second-instance', ()=>{
        if(!win.isVisible()){
            win.show()
        }
        win.focus()
    })
}else{
    app.quit()
}


let player = Player({
    name: 'deezer',
    identity: 'Deezer Desktop',
    supportedUriSchemes: ['file'],
    supportedMimeTypes: ['audio/mpeg', 'application/ogg'],
    supportedInterfaces: ['player']
})

function getPosition() {
    return 0
    let position = 0
    win.webContents.executeJavaScript(`dzPlayer.getPosition()`).then(result => {
        position = result
    })
    return parseInt(position * 1000)
}

player.getPosition = getPosition

function updatePlayer(props) {
    const { title, alburm, artist, playing, duration, cover, track_id } = props

    player.metadata = {
        'mpris:trackid': player.objectPath('track/0'),
        'mpris:length': parseInt(duration) * 1000, // In microseconds
        'mpris:artUrl': cover,
        'xesam:title': title,
        'xesam:album': alburm,
        'xesam:artist': [artist]
    }

    player.playbackStatus = playing ? Player.PLAYBACK_STATUS_PLAYING : Player.PLAYBACK_STATUS_PAUSED
}

player.on("play", play)
player.on("pause", pause)
player.on("playpause", () => {
    isPlaying(pause, play)
})
player.on("next", next)
player.on("previous", prev)


player.on("quit", ()=>{
    process.exit()
})

player.on("raise", ()=>{
    show_hide(true)
})


// Events
var events = ['quit', 'stop', 'seek', 'position', 'open', 'volume', 'loopStatus', 'shuffle'];
events.forEach(function (eventName) {
    player.on(eventName, function () {
        console.log('Event:', eventName, arguments);
    });
});

// player.canSeek = false

player.on("volume", vol => {
    console.log("Volume updated")
    console.log(vol)
})