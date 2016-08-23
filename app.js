    "use strict";

var Net              = require('net'),
    split            = require('split'),
    RoonApi          = require("node-roon-api"),
    RoonApiSettings  = require('node-roon-api-settings'),
    RoonApiStatus    = require('node-roon-api-status'),
    RoonApiTransport = require('node-roon-api-transport');

var SM_BUTTONS_PORT = 10001;
var core;
var zones = {};
var roon = new RoonApi();
var sms = { };

var mysettings = roon.load_config("settings") || {
    devices:          0,
    longpresstimeout: 500,
    seekamount:       5,
    volumesteps:      5
};

function makelayout(settings) {
    var l = {
	layout:    [],
	has_error: false
    };

    l.layout.push({
	type:    "integer",
	title:   "Number of iPort Surface Mount with Button devices",
	setting: "devices",
    });

    if (settings.devices > 0) {
        let v = {
            type:    "integer",
            min:     100,
            max:     2000,
            title:   "Long Press Timeout (milliseconds)",
            subtitle: "This is how long you have to hold the button down to register as a long press.",
            setting: "longpresstimeout",
        };
        if (settings.longpresstimeout < v.min || settings.longpresstimeout > v.max) {
            v.error = "Long Press Timeout must be between 100 and 2000 milliseconds.";
            l.has_error = true; 
        }
        l.layout.push(v);

        v = {
            type:    "integer",
            min:     1,
            max:     60,
            title:   "Seek Amount (seconds)",
            setting: "seekamount",
        };
        if (settings.seekamount < 1 || settings.seekamount > 60) {
            v.error = "Seek Amount must be between 1 and 60 seconds.";
            l.has_error = true;
        }
        l.layout.push(v);

        v = {
            type:    "integer",
            min:     1,
            max:     100,
            title:   "Volume Change Amount (steps)",
            setting: "volumesteps",
        };
        if (settings.volumesteps < 1 || settings.volumesteps > 60) {
            v.error = "Volume Change Amount must be between 1 and 100 steps.";
            l.has_error = true;
        }
        l.layout.push(v);
    }

    let i = 0;
    while (i < settings.devices) {
        i++;
        let group = {
            type:        "group",
            title:       "Device: " + i,
            collapsable: true,
            items:       [],
        };

        let name = i;
        let ip  = settings["ip" + i];

        group.items.push({
	    type:    "string",
	    title:   "IP Address",
	    setting: "ip" + i
        });

        l.layout.push(group);

        let sm = sms[ip]; 
        if (!sm) continue;

        let conn = sm.conn;
        if (conn) {
            group.title = "Device: " + conn.deviceid;

            group.items.push({
                type:    "label",
                title:   conn.model + " " + conn.version
            });

            group.items.push({
                type:    "zone",
                title:   "Zone",
                setting: "zone" + i
            });

            let ledgroup = {
                type:        "group",
                title:       "LEDs",
                collapsable: true,
                items: [],
            };
            group.items.push(ledgroup);

            // defaults
	    if (!settings["led_playing_" + i]) settings["led_playing_" + i] = '#00FF00';
	    if (!settings["led_paused_"  + i]) settings["led_paused_"  + i] = '#FFFF00';
	    if (!settings["led_loading_" + i]) settings["led_loading_" + i] = '#00FFFF';
	    if (!settings["led_stopped_" + i]) settings["led_stopped_" + i] = '#FFFFFF';

            ledgroup.items.push({
                    type:    "dropdown",
                    title:   "Music Playing Color",
                    setting: "led_playing_" + i,
                    values: [
                        { title: "White",   value: "#FFFFFF" },
                        { title: "Red",     value: "#FF0000" },
                        { title: "Green",   value: "#00FF00" },
                        { title: "Blue",    value: "#0000FF" },
                        { title: "Yellow",  value: "#FFFF00" },
                        { title: "Cyan",    value: "#00FFFF" },
                        { title: "Magenta", value: "#FF00FF" },
                        { title: "Orange",  value: "#FF8000" },
                        { title: "Pink",    value: "#FFB6C1" },
                        { title: "None",    value: "#000000" },
                    ]
            });
            ledgroup.items.push({
                    type:    "dropdown",
                    title:   "Music Paused Color",
                    setting: "led_paused_" + i,
                    values: [
                        { title: "White",   value: "#FFFFFF" },
                        { title: "Red",     value: "#FF0000" },
                        { title: "Green",   value: "#00FF00" },
                        { title: "Blue",    value: "#0000FF" },
                        { title: "Yellow",  value: "#FFFF00" },
                        { title: "Cyan",    value: "#00FFFF" },
                        { title: "Magenta", value: "#FF00FF" },
                        { title: "Orange",  value: "#FF8000" },
                        { title: "Pink",    value: "#FFB6C1" },
                        { title: "None",    value: "#000000" },
                    ]
            });
            ledgroup.items.push({
                    type:    "dropdown",
                    title:   "Music Loading Color",
                    setting: "led_loading_" + i,
                    values: [
                        { title: "White",   value: "#FFFFFF" },
                        { title: "Red",     value: "#FF0000" },
                        { title: "Green",   value: "#00FF00" },
                        { title: "Blue",    value: "#0000FF" },
                        { title: "Yellow",  value: "#FFFF00" },
                        { title: "Cyan",    value: "#00FFFF" },
                        { title: "Magenta", value: "#FF00FF" },
                        { title: "Orange",  value: "#FF8000" },
                        { title: "Pink",    value: "#FFB6C1" },
                        { title: "None",    value: "#000000" },
                    ]
            });
            ledgroup.items.push({
                    type:    "dropdown",
                    title:   "Music Stopped Color",
                    setting: "led_stopped_" + i,
                    values: [
                        { title: "White",   value: "#FFFFFF" },
                        { title: "Red",     value: "#FF0000" },
                        { title: "Green",   value: "#00FF00" },
                        { title: "Blue",    value: "#0000FF" },
                        { title: "Yellow",  value: "#FFFF00" },
                        { title: "Cyan",    value: "#00FFFF" },
                        { title: "Magenta", value: "#FF00FF" },
                        { title: "Orange",  value: "#FF8000" },
                        { title: "Pink",    value: "#FFB6C1" },
                        { title: "None",    value: "#000000" },
                    ]
            });

            let limit = 0;
            conn.keys.forEach(kvp => {
                let key = kvp.label.replace(/[^0-9]/g, '');

                // defaults
                if (!settings["press" + i + "_" + key]) {
                    if      (key == 1) settings["press" + i + "_" + key] = "toggleplay";
                    else if (key == 2) settings["press" + i + "_" + key] = "togglemute";
                    else if (key == 3) settings["press" + i + "_" + key] = "previous";
                    else if (key == 4) settings["press" + i + "_" + key] = "next";
                    else               settings["press" + i + "_" + key] = "none";
                }
                if (!settings["longpress" + i + "_" + key]) {
                    if (key == 1) settings["longpress" + i + "_" + key] = "stop";
                    else          settings["longpress" + i + "_" + key] = "none";
                }

                let keygroup = {
                    type:        "group",
                    title:       "Key " + kvp.label.replace(/[^0-9]/g, ""),
                    collapsable: true,
                    items: [],
                };
                group.items.push(keygroup);

                keygroup.items.push({
                    type:    "dropdown",
                    title:   "Press Action",
                    setting: "press" + i + "_" + key,
                    values: [
                    { title: "Toggle Play/Pause", value: "toggleplay"   },
                    { title: "Seek Forward",      value: "seekfwd"      },
                    { title: "Seek Backward",     value: "seekback"     },
                    { title: "Stop Playback",     value: "stop"         },
                    { title: "Pause All",         value: "pauseall"     },
                    { title: "Next Track",        value: "next"         },
                    { title: "Preivous Track",    value: "previous"     },
                    { title: "Toggle Mute",       value: "togglemute"   },
                    { title: "Volume Up",         value: "volumeup"     },
                    { title: "Volume Down",       value: "volumedown"   },
                    { title: "Nothing",           value: "none"         },
                    ]
                });
                keygroup.items.push({
                    type:    "dropdown",
                    title:   "Long Press Action",
                    setting: "longpress" + i + "_" + key,
                    values: [
                    { title: "Toggle Play/Pause", value: "toggleplay"   },
                    { title: "Seek Forward",      value: "seekfwd"      },
                    { title: "Seek Backward",     value: "seekback"     },
                    { title: "Stop Playback",     value: "stop"         },
                    { title: "Pause All",         value: "pauseall"     },
                    { title: "Next Track",        value: "next"         },
                    { title: "Preivous Track",    value: "previous"     },
                    { title: "Toggle Mute",       value: "togglemute"   },
                    { title: "Volume Up",         value: "volumeup"     },
                    { title: "Volume Down",       value: "volumedown"   },
                    { title: "Nothing",           value: "none"         },
                    ]
                });
            });
        } else if (sm.net) {
            group.items.push({
                type:    "label",
                title:   "Connecting to " + ip,
            });
        }
    }

    return l;
}

var svc_settings = new RoonApiSettings(roon, {
    get_settings: function(cb) {
        cb(mysettings, makelayout(mysettings).layout);
    },
    save_settings: function(req, isdryrun, settings) {
        ensure_connections(settings);
	let l = makelayout(settings);
	if (l.has_error) {
	    req.send_complete("NotValid", { settings: settings, layout: l.layout });
            return;
        }
        req.send_complete("Success", { settings: settings, layout: l.layout });

        if (!isdryrun) {
            mysettings = settings;
            update_status();
            svc_settings.update_settings(mysettings, l.layout);
            for (var ip in sms) update_led(ip, sms[ip].idx);
            roon.save_config("settings", mysettings);
        }
    }
});

var svc_status = new RoonApiStatus(roon);

function update_status() {
    var conns = 0, inits = 0, total = 0;
    let i = 0;
    while (i < mysettings.devices) {
        i++;

        let ip = mysettings["ip" + i];

        if (!ip) continue;
        let sm = sms[ip];
        if (!sm) continue; 

        total++;

        if (sm.conn) { conns++; continue; }
        if (sm.net)  { inits++; continue; }
    }

    var s = "";
    var err = false;
    if (total == 0) {
        s = "Not configured, please check settings";
        err = true;
    } else {
        if (conns > 0) {
            let t = conns + inits;
            if      (t == 1) s = "Connected to 1 device";
            else if (t >  1) s = "Connected to " + t + " devices";
            if (inits > 0) {
                if      (inits == 1) s = " (1 initializing)";
                else if (inits >  1) s = " (" + inits + " initializing)";
            }
        } else if (inits > 0) {
            if      (inits == 1) s = "Initializing 1 device";
            else if (inits >  1) s = "Initializing " + inits + " devices";
        } else {
            s = "Can not find configured devices, please check settings";
            err = true;
        }
    }
    s += '.';

    svc_status.set_status(s, err);
}

function update_led(ip, idx) {
    let sm = sms[ip]; 
    if (!sm || !sm.net) return;

    let z = mysettings['zone'+idx];
    if (!z || !core) { if (mysettings['led_stopped_' + idx]) sm.net.write('\nled=' + mysettings['led_stopped_' + idx] + '\n'); return; }

    var zone = core.services.RoonApiTransport.zone_by_object(z);
    if (!zone) { if (mysettings['led_stopped_' + idx]) sm.net.write('\nled=' + mysettings['led_stopped_' + idx] + '\n'); return; }

    if (sm.zonestate == zone.state) return;
    sm.zonestate = zone.state;
    if      (zone.state == "playing" && mysettings['led_playing_' + idx]) sm.net.write('\nled=' + mysettings['led_playing_' + idx] + '\n');
    else if (zone.state == "paused"  && mysettings['led_paused_'  + idx]) sm.net.write('\nled=' + mysettings['led_paused_'  + idx] + '\n');
    else if (zone.state == "loading" && mysettings['led_loading_' + idx]) sm.net.write('\nled=' + mysettings['led_loading_' + idx] + '\n');
    else if (zone.state == "stopped" && mysettings['led_stopped_' + idx]) sm.net.write('\nled=' + mysettings['led_stopped_' + idx] + '\n');
}

function ensure_connections(settings) {
    var changed = false;
    let i = 0;
    while (i < settings.devices) {
        i++;
        let ip = settings["ip" + i];

        if (!ip) continue;

        let sm = sms[ip];
        if (sm && (sm.conn || sm.net)) continue;

        sm = sms[ip] = {
            idx:  i,
            ip:   ip,
            conn: undefined,
            net:  new Net.Socket(),
        };

        changed = true;

        try {
            let idx = i;
            sm.net.connect(SM_BUTTONS_PORT, ip)

            sm.net.on('connect', () => {
//                console.log("SM: connected");
		update_status();
                svc_settings.update_settings();
                update_led(sm.ip, sm.idx);
            });

            sm.net.pipe(split())
                    .on('data', function (line) {
                        if (line[0] == '#') return;
                        var msg = JSON.parse(line);
                        if (!sm.conn) {
//                            console.log("SM: got first line");
                            sm.conn = msg;
                            update_status();
                            svc_settings.update_settings();
                        } else if (msg.events) {
//                            console.log("SM: got event");
                            msg.events.forEach(e => {
                                if (e.state == '1')
                                    ev_buttondown(idx, idx + "_" + e.label.replace(/[^0-9]/g, ''));
                                else
                                    ev_buttonup(idx, idx + "_" + e.label.replace(/[^0-9]/g, ''));
                            });
                        }
                    });
            sm.net.on('error', function(msg) {
                console.log("SM ERROR", msg);
                delete(sms[ip]);
                sm = undefined;
                update_status();
                svc_settings.update_settings();
            });
            sm.net.on('end', () => {
                delete(sms[ip]);
                sm = undefined;
                update_status();
                svc_settings.update_settings();
            });

        } catch (e) {
            sm.net.destroy();
            delete(sms[ip]);
            sm = undefined;
            update_status();
            svc_settings.update_settings();
        }
    }
    if (changed) {
        update_status();
        svc_settings.update_settings();
    }
}

var pressed = { };
var ignoreup;
var pressseq = 0;

function ev_buttondown(i, key) {
    if (pressed[key]) return;
//    console.log('sm clickdown: ' + key);
    var seq = ++pressseq;
    pressed[key] = seq;
    setTimeout(() => {
        if (seq != pressed[key]) return;
//	console.log('sm longpress: ' + key);
        pressed[key] = 'longpressed';
        if (!core) return;
        console.log('sm longpress: ' + key);
        let k = "longpress" + key;
        if      (mysettings[k] == "toggleplay") core.services.RoonApiTransport.control      (mysettings['zone'+i], 'playpause');
        else if (mysettings[k] == "seekfwd")    core.services.RoonApiTransport.seek         (mysettings['zone'+i], 'relative', settings.seekamount);
        else if (mysettings[k] == "seekback")   core.services.RoonApiTransport.seek         (mysettings['zone'+i], 'relative', settings.seekamount * -1);
        else if (mysettings[k] == "stop")       core.services.RoonApiTransport.control      (mysettings['zone'+i], 'stop');
        else if (mysettings[k] == "pauseall")   core.services.RoonApiTransport.pause_all    ();
        else if (mysettings[k] == "next")       core.services.RoonApiTransport.control      (mysettings['zone'+i], 'next');
        else if (mysettings[k] == "previous")   core.services.RoonApiTransport.control      (mysettings['zone'+i], 'previous');
        else if (mysettings[k] == "togglemute") core.services.RoonApiTransport.mute         (mysettings['zone'+i], 'toggle');
        else if (mysettings[k] == "volumeup")   core.services.RoonApiTransport.change_volume(mysettings['zone'+i], 'relative_step', settings.volumesteps);
        else if (mysettings[k] == "volumedown") core.services.RoonApiTransport.change_volume(mysettings['zone'+i], 'relative_step', settings.volumesteps * -1);
    }, mysettings.longpresstimeout);
}

function ev_buttonup(i, key) {
//    console.log('sm clickup: ' + key);
    if (!core) return;
    if (!pressed[key]) return;
    if (pressed[key] == "longpressed") {
        delete(pressed[key]);
        return;
    }
    delete(pressed[key]);
    console.log('sm press: ' + key);
    let k = "press" + key;
    if      (mysettings[k] == "toggleplay") core.services.RoonApiTransport.control      (mysettings['zone'+i], 'playpause');
    else if (mysettings[k] == "seekfwd")    core.services.RoonApiTransport.seek         (mysettings['zone'+i], 'relative', settings.seekamount);
    else if (mysettings[k] == "seekback")   core.services.RoonApiTransport.seek         (mysettings['zone'+i], 'relative', settings.seekamount * -1);
    else if (mysettings[k] == "stop")       core.services.RoonApiTransport.control      (mysettings['zone'+i], 'stop');
    else if (mysettings[k] == "pauseall")   core.services.RoonApiTransport.pause_all    ();
    else if (mysettings[k] == "next")       core.services.RoonApiTransport.control      (mysettings['zone'+i], 'next');
    else if (mysettings[k] == "previous")   core.services.RoonApiTransport.control      (mysettings['zone'+i], 'previous');
    else if (mysettings[k] == "togglemute") core.services.RoonApiTransport.mute         (mysettings['zone'+i], 'toggle');
    else if (mysettings[k] == "volumeup")   core.services.RoonApiTransport.change_volume(mysettings['zone'+i], 'relative_step', settings.volumesteps);
    else if (mysettings[k] == "volumedown") core.services.RoonApiTransport.change_volume(mysettings['zone'+i], 'relative_step', settings.volumesteps * -1);
}

ensure_connections(mysettings);
setInterval(() => ensure_connections(mysettings), 1000);

var extension = roon.extension({
    extension_id:        'com.roonlabs.iport.smbuttons_controller',
    display_name:        'iPort Surface Mount with Buttons controller',
    display_version:     "1.0.0",
    publisher:           'Roon Labs, LLC',
    email:               'contact@roonlabs.com',
    website:             'https://github.com/RoonLabs/roon-extension-iport-sm-buttons',
    required_services:   [ RoonApiTransport ],
    optional_services:   [ ],
    provided_services:   [ svc_settings, svc_status ],

    core_paired: function(core_) {
        core = core_;
        core.services.RoonApiTransport.subscribe_zones((response, msg) => {
            for (var ip in sms) update_led(ip, sms[ip].idx);
        });
    },
    core_unpaired: function(core_) {
	core = undefined;
        zones = {};
    }
});

var go;
go = function() { extension.connect("localhost:9100", () => setTimeout(go, 3000)); };
go();
