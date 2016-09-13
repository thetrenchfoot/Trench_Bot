try {
    // Get all the basic modules and files setup
    const Discord = require("discord.js");
    var configs = require("./data/config.json");
    const configDefaults = require("./defaults.json");
    var AuthDetails = require("./auth.json");
    var profileData = require("./data/profiles.json");
    var stats = require("./data/stats.json");
    var filter = require("./filter.json");
    var reminders = require("./data/reminders.json");
    var polls = require("./data/polls.json");
    var giveaways = require("./data/giveaways.json");
    var logs = require("./data/logs.json");
    const emotes = require("./emotes.json");
    const memes = require("./memes.json");
    const manga = require("./manga.json").manga;

    // Hijack spawn for auto-update to work properly
    (function() {
        var childProcess = require("child_process");
        childProcess.spawn = require("cross-spawn");
    })();

    // Misc. modules to make everything work
    var os = require("os");
    var domainRoot = require("domain");
    var domain = domainRoot.create();
    var express = require("express");
    var bodyParser = require("body-parser");
    const writeFileAtomic = require("write-file-atomic");
    const youtube_node = require("youtube-node");
    const unirest = require("unirest");
    const request = require("request");
    const levenshtein = require("fast-levenshtein");
    const qs = require("querystring");
    const fs = require("fs");
    const Wiki = require("wikijs");
    const feed = require("feed-read");
    const convert = require("convert-units");
    const imgur = require("imgur-node-api");
    var wolfram;
    const urban = require("urban");
    const base64 = require("node-base64-image");
    const weather = require("weather-js");
    const fx = require("money");
    const cheerio = require("cheerio");
    const util = require("util");
    const vm = require("vm");
    const readline = require("readline");
    const searcher = require("google-search-scraper");
    const urlInfo = require("url-info-scraper");
    const itunes = require("searchitunes");
    const googl = require("goo.gl");
    const emoji = require("emoji-dictionary");
    const removeMd = require("remove-markdown");
    const mathjs = require("mathjs");
    const jokesearch = require("jokesearch");
    const bingTranslate = require("bing-translate").init({
        client_id: AuthDetails.microsoft_client_id,
        client_secret: AuthDetails.microsoft_client_secret
    });
    const xmlparser = require("xml-parser");
} catch(startError) {
    console.log(startError.stack);
    console.log("Exiting...");
    process.exit(1);
}

// Bot setup
var version = "3.4";
var outOfDate = 0;
var readyToGo = false;
var disconnects = 0;
var openedweb = false;
var statsToClear = [];
var readiedServers = {};

// Set up message counter
var messages = {};
var voice = {};

// Active select menus
var selectmenu = {};

// Room command setup
var rooms = {};

// Spam/NSFW detection stuff
var spams = {};
var cooldowns = {};
var filterviolations = {};
var nodeletemembermsg = {};

// Online console sessions
var adminconsole = {};
var extensiontestlogs = {};
var admintime = {};
var updateconsole = false;
var maintainerconsole = false;
var onlineconsole = {};

// Stuff for voting and lotteries
var novoting = {};
var pointsball = 20;
var lottery = {};

// Set up webserver for online bot status
var app = express();
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
var server_port = 8080;
var server_ip_address = "127.0.0.1";

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.get("/data", function(req, res) {
    var data = {};

    if(req.query.section=="list" && req.query.type) {
        if(req.query.type=="servers") {
            data.stream = [];
            for(var i=0; i<bot.servers.length; i++) {
                data.stream.push([bot.servers[i].name, bot.servers[i].id]);
            }
            data.stream.sort(function(a, b) {
                a = a[0].toUpperCase();
                b = b[0].toUpperCase();
                return a < b ? -1 : a > b ? 1 : 0;
            });
        } else if(req.query.type=="members" && req.query.svrid) {
            var svr = bot.servers.get("id", req.query.svrid);
            if(svr) {
                if(configs.servers[svr.id].showsvr && configs.servers[svr.id].showpub) {
                    data.stream = [];
                    for(var i=0; i<svr.members.length; i++) {
                        if(svr.members[i].username && svr.members[i].id && svr.members[i].id!=bot.user.id) {
                            data.stream.push([svr.members[i].username + (svr.members[i].bot ? " [BOT]" : ""), svr.members[i].id, svr.detailsOfUser(svr.members[i]).nick]);
                        }
                    }
                    data.stream.sort(function(a, b) {
                        a = a[0].toUpperCase();
                        b = b[0].toUpperCase();
                        return a < b ? -1 : a > b ? 1 : 0;
                    });
                }
            }
        } else if(req.query.type=="logids") {
            data.stream = getLogIDs().sort(function(a, b) {
                if(a[0] && b[0]) {
                    a = a[0][1].toUpperCase();
                    b = b[0][1].toUpperCase();
                    return a < b ? -1 : a > b ? 1 : 0;
                } else if(a[0] && !b[0]) {
                    return 1;
                } else if(!a[0] && b[0]) {
                    return -1;
                } else {
                    a = a[1][1].toUpperCase();
                    b = b[1][1].toUpperCase();
                    return a < b ? -1 : a > b ? 1 : 0;
                }
            });
        } else if(req.query.type=="bot") {
            data = {
                username: bot.user.username,
                id: bot.user.id,
                oauthurl: "https://discordapp.com/oauth2/authorize?&client_id=" + AuthDetails.client_id + "&scope=bot&permissions=0",
                uptime: secondsToString(process.uptime()),
                version: version,
                disconnects: disconnects,
                avatar: bot.user.avatarURL || "http://i.imgur.com/fU70HJK.png",
                servers: bot.servers.length,
                users: bot.users.length
            };
        }
    } else if(req.query.section=="stats" && req.query.type && req.query.svrid) {
        var svr = bot.servers.get("id", req.query.svrid);
        if(svr) {
            if(configs.servers[svr.id].showsvr && configs.servers[svr.id].showpub) {
                if(req.query.type=="profile" && req.query.usrid) {
                    var usr = svr.members.get("id", req.query.usrid);
                    if(usr) {
                        data = getProfile(usr, svr);
                    }
                } else if(req.query.type=="server") {
                    data = getStats(svr);
                    data.name = svr.name;
                    data.icon = svr.iconURL || "http://i.imgur.com/fU70HJK.png";
                }
            }
        }
    } else if(req.query.section=="servers" && ["svrnm", "messages", "members"].indexOf(req.query.sort)>-1) {
        data.stream = [];
        for(var i=0; i<bot.servers.length; i++) {
            if(configs.servers[bot.servers[i].id].showsvr) {
                var icon = bot.servers[i].iconURL || "http://i.imgur.com/fU70HJK.png";
                var name = bot.servers[i].name;
                var owner = bot.servers[i].owner.username;
                var ms = messages[bot.servers[i].id] || 0;
                var total = bot.servers[i].members.length;
                var online = bot.servers[i].members.getAll("status", "online").length;
                var idle = bot.servers[i].members.getAll("status", "idle").length;
                var listing = configs.servers[bot.servers[i].id].listing.enabled ? configs.servers[bot.servers[i].id].listing : {enabled: false};
                data.stream.push([icon, name, owner, ms, total + " total, " + online + " online, " + idle + " idle", listing]);
            }
        }
        data.stream.sort(function(a, b) {
            if(req.query.sort=="svrnm") {
                a = a[1].toUpperCase();
                b = b[1].toUpperCase();
                return a < b ? -1 : a > b ? 1 : 0;
            }
            if(req.query.sort=="messages") {
                return b[3] - a[3];
            }
            if(req.query.sort=="members") {
                return parseInt(b[4].substring(0, b[4].indexOf(" "))) - parseInt(a[4].substring(0, a[4].indexOf(" ")));
            }
        });
    } else if(req.query.section=="log") {
        var id = [null, "null", undefined, "undefined"].indexOf(req.query.id)>-1 ? null : decodeURI(req.query.id);
        var level = [null, "null", undefined, "undefined"].indexOf(req.query.level)>-1 ? null : decodeURI(req.query.level);
        var logList = getLog(id, level);
        data.stream = logList;
    } else if(req.query.auth) {
        data = getOnlineConsole(req.query.auth);

        if(req.query.type=="maintainer" && Object.keys(data).length>0) {
            var consoleid = data.usrid.slice(0);
            clearTimeout(onlineconsole[data.usrid].timer);
            onlineconsole[data.usrid].timer = setTimeout(function() {
                logMsg(Date.now(), "INFO", "General", null, "Timeout on online maintainer console");
                delete onlineconsole[consoleid];
            }, 300000);

            var servers = [];
            for(var i=0; i<bot.servers.length; i++) {
                var channels = [];
                for(var j=0; j<bot.servers[i].channels.length; j++) {
                    if(!(bot.servers[i].channels[j] instanceof Discord.VoiceChannel)) {
                        channels.push([bot.servers[i].channels[j].name, bot.servers[i].channels[j].id, bot.servers[i].channels[j].position]);
                    }
                }
                channels.sort(function(a, b) {
                    return a[2] - b[2];
                });
                servers.push([bot.servers[i].iconURL || "http://i.imgur.com/fU70HJK.png", bot.servers[i].name, bot.servers[i].id, "@" + bot.servers[i].owner.username + "#" + bot.servers[i].owner.discriminator, channels]);
            }
            servers.sort(function(a, b) {
                a = a[1].toUpperCase();
                b = b[1].toUpperCase();
                return a < b ? -1 : a > b ? 1 : 0;
            });

            var userList = [];
            for(var i=0; i<bot.users.length; i++) {
                if([bot.user.id, configs.maintainer].indexOf(bot.users[i].id)==-1 && bot.users[i].username && bot.users[i].id) {
                    userList.push([bot.users[i].username + "#" + bot.users[i].discriminator + (bot.users[i].bot ? " [BOT]" : ""), bot.users[i].id, profileData[bot.users[i].id] ? profileData[bot.users[i].id].points : 0]);
                }
            }
            userList.sort(function(a, b) {
                a = a[0].toUpperCase();
                b = b[0].toUpperCase();
                return a < b ? -1 : a > b ? 1 : 0;
            });

            var blockedUsers = [];
            for(var i=0; i<configs.botblocked.length; i++) {
                var usr = bot.users.get("id", configs.botblocked[i]);
                if(usr && usr.username) {
                    blockedUsers.push([usr.avatarURL || "http://i.imgur.com/fU70HJK.png", usr.username + "#" + usr.discriminator + (usr.bot ? " [BOT]" : ""), usr.id]);
                }
            }
            blockedUsers.sort(function(a, b) {
                a = a[1].toUpperCase();
                b = b[1].toUpperCase();
                return a < b ? -1 : a > b ? 1 : 0;
            });

            data = {
                maintainer: bot.users.get("id", configs.maintainer) ? (bot.users.get("id", configs.maintainer).username + "#" + bot.users.get("id", configs.maintainer).discriminator) : null,
                pmforward: configs.pmforward,
                commandusage: totalCommandUsage(),
                statsage: prettyDate(new Date(stats.timestamp)),
                username: bot.user.username,
                oauthurl: "https://discordapp.com/oauth2/authorize?&client_id=" + AuthDetails.client_id + "&scope=bot&permissions=0",
                avatar: bot.user.avatarURL || "http://i.imgur.com/fU70HJK.png",
                game: getGame(bot.user),
                defaultgame: configs.game=="default",
                status: bot.user.status,
                members: userList,
                botblocked: blockedUsers,
                servers: servers
            };
        } else if(req.query.type=="admin" && Object.keys(data).length>0) {
            var svr = bot.servers.get("id", data.svrid);
            if(svr) {
                var consoleid = data.usrid.slice(0);
                clearTimeout(onlineconsole[data.usrid].timer);
                onlineconsole[data.usrid].timer = setTimeout(function() {
                    logMsg(Date.now(), "INFO", null, consoleid, "Timeout on online admin console for " + svr.name);
                    delete adminconsole[consoleid];
                    delete onlineconsole[consoleid];
                }, 300000);
                data = {};

                var channels = [];
                for(var i=0; i<svr.channels.length; i++) {
                    if(!(svr.channels[i] instanceof Discord.VoiceChannel)) {
                        channels.push([svr.channels[i].name, svr.channels[i].id, svr.channels[i].position]);
                    }
                }
                channels.sort(function(a, b) {
                    return a[2] - b[2];
                });

                var voiceChannels = [];
                for(var i=0; i<svr.channels.length; i++) {
                    if(svr.channels[i] instanceof Discord.VoiceChannel) {
                        voiceChannels.push([svr.channels[i].name, svr.channels[i].id, svr.channels[i].position]);
                    }
                }
                voiceChannels.sort(function(a, b) {
                    return a[2] - b[2];
                });

                var roles = [];
                for(var i=0; i<svr.roles.length; i++) {
                    if(svr.roles[i].name!="@everyone" && svr.roles[i].name.indexOf("color-")!=0) {
                        roles.push([svr.roles[i].name, svr.roles[i].id, svr.roles[i].position, svr.roles[i].colorAsHex()]);
                    }
                }
                roles.sort(function(a, b) {
                    return a[2] - b[2];
                });

                var members = [];
                for(var i=0; i<svr.members.length; i++) {
                    if(configs.botblocked.indexOf(svr.members[i].id)==-1 && svr.members[i].id!=bot.user.id && svr.members[i].username && svr.members[i].id) {
                        members.push([svr.members[i].username + "#" + svr.members[i].discriminator + (svr.members[i].bot ? " [BOT]" : ""), svr.members[i].id, svr.detailsOfUser(svr.members[i]).nick]);
                    }
                }
                members.sort(function(a, b) {
                    a = a[0].toUpperCase();
                    b = b[0].toUpperCase();
                    return a < b ? -1 : a > b ? 1 : 0;
                });

                var currentConfig = {};
                for(var key in configs.servers[svr.id]) {
                    if(["admins", "blocked"].indexOf(key)>-1) {
                        currentConfig[key] = [];
                        for(var i=0; i<configs.servers[svr.id][key].length; i++) {
                            var usr = svr.members.get("id", configs.servers[svr.id][key][i]);
                            if(usr && configs.botblocked.indexOf(usr.id)==-1) {
                                currentConfig[key].push([usr.avatarURL || "http://i.imgur.com/fU70HJK.png", usr.username + "#" + usr.discriminator + (usr.bot ? " [BOT]" : ""), usr.id, false]);
                            }
                        }
                        if(key=="blocked") {
                            for(var i=0; i<configs.botblocked.length; i++) {
                                var usr = svr.members.get("id", configs.botblocked[i]);
                                if(usr && usr.username) {
                                    currentConfig[key].push([usr.avatarURL || "http://i.imgur.com/fU70HJK.png", usr.username + "#" + usr.discriminator + (usr.bot ? " [BOT]" : "") + " (global)", usr.id, true]);
                                }
                            }
                        }
                        currentConfig[key].sort(function(a, b) {
                            a = a[1].toUpperCase();
                            b = b[1].toUpperCase();
                            return a < b ? -1 : a > b ? 1 : 0;
                        });
                    } else if(key=="rankslist") {
                        currentConfig[key] = [];
                        for(var i=0; i<configs.servers[svr.id].rankslist.length; i++) {
                            var role = svr.roles.get("id", configs.servers[svr.id].rankslist[i].role);
                            currentConfig[key].push([configs.servers[svr.id].rankslist[i].name, configs.servers[svr.id].rankslist[i].max, role ? [role.name, role.colorAsHex()] : null, getMembersWithRank(svr, configs.servers[svr.id].rankslist[i]).length]);
                        }
                    } else if(key=="translated") {
                        currentConfig[key] = [];
                        for(var i=0; i<configs.servers[svr.id][key].list.length; i++) {
                            var usr = svr.members.get("id", configs.servers[svr.id][key].list[i]);
                            var trchannels = "";
                            for(var j=0; j<configs.servers[svr.id][key].channels[i].length; j++) {
                                var ch = svr.channels.get("id", configs.servers[svr.id][key].channels[i][j]);
                                if(ch) {
                                    trchannels += (trchannels.length==0 ? "" : ", ") + "#" + ch.name;
                                }
                            }
                            if(usr && configs.botblocked.indexOf(usr.id)==-1) {
                                currentConfig[key].push([usr.avatarURL || "http://i.imgur.com/fU70HJK.png", usr.username + "#" + usr.discriminator + (usr.bot ? " [BOT]" : ""), usr.id, configs.servers[svr.id][key].langs[i], trchannels]);
                            }
                        }
                        currentConfig[key].sort(function(a, b) {
                            a = a[1].toUpperCase();
                            b = b[1].toUpperCase();
                            return a < b ? -1 : a > b ? 1 : 0;
                        });
                    } else if(key=="muted") {
                        var mutedUsers = [];
                        for(var chid in configs.servers[svr.id].muted) {
                            if(svr.channels.get("id", chid)) {
                                for(var i=0; i<configs.servers[svr.id].muted[chid].length; i++) {
                                    if(mutedUsers.indexOf(configs.servers[svr.id].muted[chid][i])==-1) {
                                        mutedUsers.push(configs.servers[svr.id].muted[chid][i]);
                                    }
                                }
                            }
                        }
                        currentConfig[key] = [];
                        for(var i=0; i<mutedUsers.length; i++) {
                            var usr = svr.members.get("id", mutedUsers[i]);
                            if(usr) {
                                currentConfig[key].push([usr.avatarURL || "http://i.imgur.com/fU70HJK.png", usr.username + "#" + usr.discriminator + (usr.bot ? " [BOT]" : ""), usr.id, checkUserMute(usr, svr)]);
                            }
                        }
                        currentConfig[key].sort(function(a, b) {
                            a = a[1].toUpperCase();
                            b = b[1].toUpperCase();
                            return a < b ? -1 : a > b ? 1 : 0;
                        });
                    } else if(key=="triviasets") {
                        currentConfig[key] = [];
                        for(var tset in configs.servers[svr.id][key]) {
                            currentConfig[key].push([tset, configs.servers[svr.id][key][tset].length, configs.servers[svr.id][key][tset]]);
                        }
                        currentConfig[key].sort(function(a, b) {
                            a = a[0].toUpperCase();
                            b = b[0].toUpperCase();
                            return a < b ? -1 : a > b ? 1 : 0;
                        });
                    } else if(key=="tags") {
                        currentConfig[key] = [];
                        var cleanTag = function(content) {
                            var cleanContent = "";
                            while(content.indexOf("<")>-1) {
                                cleanContent += content.substring(0, content.indexOf("<"));
                                content = content.substring(content.indexOf("<")+1);
                                if(content && content.indexOf(">")>1) {
                                    var type = content.charAt(0);
                                    var id = content.substring(1, content.indexOf(">"));
                                    if(!isNaN(id)) {
                                        if(type=='@') {
                                            var usr = svr.members.get("id", id);
                                            if(usr) {
                                                cleanContent += "<b>@" + usr.username + "</b>";
                                                content = content.substring(content.indexOf(">")+1);
                                                continue;
                                            }
                                        } else if(type=='#') {
                                            var ch = svr.channels.get("id", id);
                                            if(ch) {
                                                cleanContent += "<b>#" + ch.name + "</b>";
                                                content = content.substring(content.indexOf(">")+1);
                                                continue;
                                            }
                                        }
                                    }
                                }
                                cleanContent += "<";
                            }
                            cleanContent += content;
                            return cleanContent;
                        };
                        for(var tag in configs.servers[svr.id][key]) {
                            currentConfig[key].push([[tag, cleanTag(tag)], cleanTag(configs.servers[svr.id][key][tag]), configs.servers[svr.id].tagcommands.indexOf(tag)>-1, configs.servers[svr.id].lockedtags.indexOf(tag)>-1]);
                        }
                        currentConfig[key].sort(function(a, b) {
                            a = a[0][1].toUpperCase();
                            b = b[0][1].toUpperCase();
                            return a < b ? -1 : a > b ? 1 : 0;
                        });
                    } else if(["countdowns", "tagcommands", "lockedtags"].indexOf(key)==-1) {
                        currentConfig[key] = configs.servers[svr.id][key];
                    }
                }

                var strikeList = [];
                for(var usrid in stats[svr.id].members) {
                    if(stats[svr.id].members[usrid].strikes.length>0) {
                        var usr = svr.members.get("id", usrid);
                        if(usr) {
                            var s = [];
                            for(var i=0; i<stats[svr.id].members[usrid].strikes.length; i++) {
                                var m = svr.members.get("id", stats[svr.id].members[usrid].strikes[i][0]);
                                s.push([m ? (m.username + "#" + m.discriminator + (m.bot ? " [BOT]" : "")) : stats[svr.id].members[usrid].strikes[i][0], stats[svr.id].members[usrid].strikes[i][1], stats[svr.id].members[usrid].strikes[i][2] ? prettyDate(new Date(stats[svr.id].members[usrid].strikes[i][2])) : "Unknown"]);
                            }
                            strikeList.push([usr.id, usr.avatarURL || "http://i.imgur.com/fU70HJK.png", usr.username + "#" + usr.discriminator, s]);
                        }
                    }
                }
                strikeList.sort(function(a, b) {
                    return a[3].length - b[3].length;
                });

                var closepolls = [];
                for(var usrid in polls) {
                    var usr = svr.members.get("id", usrid);
                    var ch = svr.channels.get("id", polls[usrid].channel);
                    if(polls[usrid].open && usr && ch) {
                        closepolls.push([usrid, "\"" + polls[usrid].title + "\" in #" + ch.name + " by @" + usr.username + "#" + usr.discriminator + " with " + polls[usrid].responses.length + " response" + (polls[usrid].responses.length==1 ? "" : "s") + ", started " + secondsToString((Date.now() - polls[usrid].timestamp)/1000) + "ago"]);
                    }
                }

                var endtrivia = [];
                for(var chid in stats[svr.id].trivia) {
                    ch = svr.channels.get("id", chid);
                    if(ch) {
                        endtrivia.push([chid, "Game in #" + ch.name + " with " + (stats[svr.id].trivia[chid].tset || "default") + " set and current score " + stats[svr.id].trivia[chid].score + " out of " + (stats[svr.id].trivia[chid].possible==1 ? stats[svr.id].trivia[chid].possible : (stats[svr.id].trivia[chid].possible-1))]);
                    }
                }

                var endgiveaways = [];
                for(var usrid in giveaways) {
                    var usr = svr.members.get("id", usrid);
                    var ch = svr.channels.get("id", giveaways[usrid].channel);
                    if(usr && ch) {
                        endgiveaways.push([usrid, "<code>" + giveaways[usrid].name + "</code> started by @" + usr.username + "#" + usr.discriminator + " with " + giveaways[usrid].enrolled.length + " member" + (giveaways[usrid].enrolled.length==1 ? "" : "s") + " enrolled"]);
                    }
                }

                data = {
                    botnm: (svr.detailsOfUser(bot.user).nick || bot.user.username),
                    usrid: consoleid,
                    svrid: svr.id,
                    svrnm: svr.name,
                    joined: secondsToString((new Date() - new Date(svr.detailsOfUser(bot.user).joinedAt)) / 1000),
                    svricon: svr.iconURL || "http://i.imgur.com/fU70HJK.png",
                    channels: channels,
                    vc: voiceChannels,
                    roles: roles,
                    members: members,
                    configs: currentConfig,
                    strikes: strikeList,
                    polls: closepolls,
                    trivia: endtrivia,
                    giveaways: endgiveaways
                };
            } else {
                data = {};
            }
        } else if(req.query.type) {
            data = {};
        }
    }

    res.json(data);
});

app.get("/", function(req, res) {
    var html = fs.readFileSync("./web/index.html");
    res.writeHead(200, {"Content-Type": "text/html"});
    res.end(html);
});

app.get("/maintainer", function(req, res) {
    var html = fs.readFileSync("./web/maintainer.html");
    res.writeHead(200, {"Content-Type": "text/html"});
    res.end(html);
});

app.get("/admin", function(req, res) {
    var html = fs.readFileSync("./web/admin.html");
    res.writeHead(200, {"Content-Type": "text/html"});
    res.end(html);
});

app.use(express.static("web"));

app.post("/config", function(req, res) {
    if(req.query.auth && req.query.type) {
        var data = getOnlineConsole(req.query.auth);
        if(Object.keys(data).length>0) {
            var consoleid = data.usrid.slice(0);
            clearTimeout(onlineconsole[consoleid].timer);

            if(req.query.type=="maintainer") {
                onlineconsole[consoleid].timer = setTimeout(function() {
                    logMsg(Date.now(), "INFO", "General", null, "Timeout on online maintainer console");
                    delete onlineconsole[consoleid];
                }, 300000);

                parseMaintainerConfig(req.body, consoleid, function(err) {
                    res.sendStatus(err ? 400 : 200);
                });
            } else if(req.query.type=="admin" && req.query.svrid && req.query.usrid) {
                onlineconsole[consoleid].timer = setTimeout(function() {
                    logMsg(Date.now(), "INFO", null, consoleid, "Timeout on online admin console for " + svr.name);
                    delete adminconsole[consoleid];
                    delete onlineconsole[consoleid];
                }, 300000);

                svr = bot.servers.get("id", req.query.svrid);
                if(svr) {
                    parseAdminConfig(req.body, svr, req.query.usrid, function(err) {
                        res.sendStatus(err ? 400 : 200);
                    });
                } else {
                    res.sendStatus(400);
                }
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400);
    }
});

app.get("/archive", function(req, res) {
    if(Object.keys(getOnlineConsole(req.query.auth)).length>0) {
        if(req.query.type=="admin" && req.query.svrid && req.query.chid && req.query.num) {
            var svr = bot.servers.get("id", req.query.svrid)
            if(svr) {
                var ch = svr.channels.get("id", req.query.chid);
                if(ch && !isNaN(req.query.num)) {
                    archiveMessages(ch, parseInt(req.query.num), function(err, archive) {
                        if(err) {
                            res.json({});
                        } else {
                            res.json(archive);
                        }
                    });
                } else {
                    res.json({});
                }
            } else {
                res.json({});
            }
        }
    }
});

app.post("/extension", function(req, res) {
    if(req.query.auth && req.query.svrid && req.query.type && (req.query.chid || req.query.type=="final")) {
        var data = getOnlineConsole(req.query.auth);
        if(Object.keys(data).length>0) {
            var consoleid = data.usrid.slice(0);
            clearTimeout(onlineconsole[consoleid].timer);

            var svr = bot.servers.get("id", req.query.svrid);
            if(svr) {
                if(!extensiontestlogs[svr.id]) {
                    var extensionCallback = function(valid) {
                        if(valid!=null) {
                            res.json({
                                isValid: valid,
                                extensionLog: extensiontestlogs[svr.id]
                            });
                            delete extensiontestlogs[svr.id];
                        } else {
                            res.sendStatus(400);
                        }
                    };
                    switch(req.query.type) {
                        case "test":
                            var ch = svr.channels.get("id", req.query.chid);
                            if(ch) {
                                testExtension(req.body, svr, ch, consoleid, extensionCallback);
                            } else {
                                res.sendStatus(400);
                                return;
                            }
                            break;
                        case "final":
                            addExtension(req.body.extension, svr, consoleid, extensionCallback);
                            break;
                        default:
                            res.sendStatus(400);
                            break;
                    }
                } else {
                    res.sendStatus(400);    
                }
            } else {
                res.sendStatus(400);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(400);
    }
});

app.get("/file", function(req, res) {
    var data = getOnlineConsole(req.query.auth);
    if(Object.keys(data).length>0 && req.query.type) {
        if(data.type=="maintainer" && ["stats", "logs", "reminders", "profiles", "config", "polls", "giveaways"].indexOf(req.query.type.toLowerCase())>-1) {
            var consoleid = data.usrid.slice(0);
            clearTimeout(onlineconsole[consoleid].timer);
            onlineconsole[consoleid].timer = setTimeout(function() {
                logMsg(Date.now(), "INFO", "General", null, "Timeout on online maintainer console");
                delete onlineconsole[consoleid];
            }, 300000);
            saveData("./data/" + req.query.type.toLowerCase() + ".json", function(err) {
                res.sendFile(__dirname + "/data/" + req.query.type + ".json");
            });
        }
    }
});

app.get('*', function(req, res){
    var html = fs.readFileSync("./web/error.html");
    res.writeHead(404, {"Content-Type": "text/html"});
    res.end(html);
});

// List of bot commands along with usage and process for each
var commands = {
    // Eval for maintainer only
    "eval": {
        process: function(bot, msg, suffix) {
            if(msg.author.id==configs.maintainer) {
                if(suffix) {
                    try {
                        bot.sendMessage(msg.channel, "```" + eval(suffix) + "```");
                    } catch(err) {
                        bot.sendMessage(msg.channel, "```" + err + "```");
                    }
                }
            } else {
                bot.sendMessage(msg.channel, msg.author + " Who do you think you are?! LOL");
            }
        }
    },
    // Gives useful system and bot info
    "debug": {
        process: function(bot, msg, suffix) {
            bot.sendMessage(msg.channel, "```System info: " + process.platform + "-" + process.arch + " with " + process.release.name + " " + process.version + "\nProcess info: PID " + process.pid + " at " + process.cwd() + "\nProcess memory usage: " + Math.ceil(process.memoryUsage().heapTotal / 1000000) + " MB\nSystem memory usage: " + Math.ceil((os.totalmem() - os.freemem()) / 1000000) + " of " + Math.ceil(os.totalmem() / 1000000) + " MB\nBot info: ID " + bot.user.id + " #" + bot.user.discriminator + "```");
        } 
    },
    // Checks if bot is alive and shows version and uptime
    "ping": {
        process: function(bot, msg) {
            var info = "Pong! " + (msg.channel.server.detailsOfUser(bot.user).nick || bot.user.username) + " v" + version + " by **@BitQuote** running for " + secondsToString(process.uptime()).slice(0, -1) + ". Serving in " + bot.servers.length + " server" + (bot.servers.length==1 ? "" : "s") + " and " + bot.users.length + " user" + (bot.users.length==1 ? "" : "s");
            if(configs.hosting!="") {
                info += ". Status: " + configs.hosting;
            }
            bot.sendMessage(msg.channel, info);
        }
    },
    // Provides OAuth URL for adding new server
    "join": {
        process: function(bot, msg) {
            bot.sendMessage(msg.channel, "https://discordapp.com/oauth2/authorize?&client_id=" + AuthDetails.client_id + "&scope=bot&permissions=0");
        }
    },
    // About AwesomeBot!
    "about": {
        usage: "[<\"bug\" or \"suggestion\">]",
        process: function(bot, msg, suffix) {
            if(["bug", "suggestion", "feature", "issue"].indexOf(suffix.toLowerCase())>-1) {
                bot.sendMessage(msg.channel, "Please file your " + suffix.toLowerCase() + " here: https://github.com/BitQuote/AwesomeBot/issues/new");
            } else {
                bot.sendMessage(msg.channel, "Use `" + getPrefix(msg.channel.server) + "help` to list commands. Created by **@BitQuote**. Built on NodeJS with DiscordJS. Go to http://awesomebot.xyz/ to learn more, or join http://discord.awesomebot.xyz/\n\n*This project is in no way affiliated with Alphabet, Inc., who does not own or endorse this product.*");
            }
        }
    },
    // Gets info for this server
    "info": {
        process: function(bot, msg) {
            bot.sendMessage(msg.channel, "__" + msg.channel.server.name + "__\n**ID:** " + msg.channel.server.id + "\n**Owner:** @" + getName(msg.channel.server, msg.channel.server.owner) + "\n**Members:** " + msg.channel.server.members.length + "\n**Icon:** " + (msg.channel.server.iconURL || "None"), function() {
                bot.sendMessage(msg.channel, "**Command Prefix:** " + (configs.servers[msg.channel.server.id].cmdtag=="tag" ? ("@" + (msg.channel.server.detailsOfUser(bot.user).nick || bot.user.username)) : configs.servers[msg.channel.server.id].cmdtag) + "\n**Messages:** " + messages[msg.channel.server.id] + (configs.servers[msg.channel.server.id].listing.enabled ? ("\n**Invite:** " + configs.servers[msg.channel.server.id].listing.invite + "\n**Description:** " + removeMd(configs.servers[msg.channel.server.id].listing.description)) : ""));
            });
        }
    },
    // Shows top 5 games and active members
    "stats": {
        usage: "[clear]",
        process: function(bot, msg, suffix) {
            if(!stats[msg.channel.server.id]) {
                logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to read stats");
                bot.sendMessage(msg.channel, "Somehow, some way, I don't have any stats for this server :worried:");
                return;
            }

            var data = getStats(msg.channel.server);
            var info = "**" + msg.channel.server.name + " (this week)**"
            for(var cat in data) {
                info += "\n__" + cat + "__:" + (cat=="Data since" ? (" " + data[cat]) : "");
                if(cat!="Data since") {
                    for(var i=0; i<data[cat].length; i++) {
                        info += "\n\t" + data[cat][i];
                    }
                }
            }
            bot.sendMessage(msg.channel, info);

            if(suffix.toLowerCase()=="clear" && configs.servers[msg.channel.server.id].admins.indexOf(msg.author.id)>-1) {
                stats.timestamp = Date.now();
                clearServerStats(msg.channel.server.id);
                logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Cleared stats for at admin's request");
            }
        }
    },
    // Admin-only todo list
    "list": {
        usage: "[<new entry, \"done\", or \"remove\">] [<no. to finish or remove>]",
        process: function(bot, msg, suffix) {
            if(!suffix) {
                var info = "";
                for(var i=0; i<configs.servers[msg.channel.server.id].listsrc.length; i++) {
                    info += "[" + (configs.servers[msg.channel.server.id].listsrc[i][0] ? "x" : "  ") + "] " + configs.servers[msg.channel.server.id].listsrc[i][1] + "\n";
                }
                if(!info) {
                    info = "There's nothing in the list. Add something with `" + getPrefix(msg.channel.server) + "list <new entry>`";
                }
                bot.sendMessage(msg.channel, info);
                return;
            } else if(suffix.toLowerCase().indexOf("done ")==0 && suffix.length>5 && !isNaN(suffix.substring(suffix.indexOf(" ")+1)) && parseInt(suffix.substring(suffix.indexOf(" ")+1))<configs.servers[msg.channel.server.id].listsrc.length) {
                configs.servers[msg.channel.server.id].listsrc[parseInt(suffix.substring(suffix.indexOf(" ")+1))][0] = true;
                logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Marked item " + suffix.substring(suffix.indexOf(" ")+1) + " in list as done");
                bot.sendMessage(msg.channel, "Got it!");
            } else if(suffix.toLowerCase().indexOf("remove ")==0 && suffix.length>7 && !isNaN(suffix.substring(suffix.indexOf(" ")+1)) && parseInt(suffix.substring(suffix.indexOf(" ")+1))<configs.servers[msg.channel.server.id].listsrc.length) {
                configs.servers[msg.channel.server.id].listsrc.splice(parseInt(suffix.substring(suffix.indexOf(" ")+1)), 1);
                logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Removed item " + suffix.substring(suffix.indexOf(" ")+1) + " from list");
                bot.sendMessage(msg.channel, "Removed!");
            } else {
                configs.servers[msg.channel.server.id].listsrc.push([false, suffix]);
                logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Added item '" + suffix + "' to list");
                bot.sendMessage(msg.channel, "Added!");
            }
        }
    },
    // Performs a calculation
    "calc": {
        usage: "<expression>",
        process: function(bot, msg, suffix) {
            if(suffix) {
                try {
                    bot.sendMessage(msg.channel, "```" + mathjs.eval(suffix) + "```");
                } catch(err) {
                    bot.sendMessage(msg.channel, "```" + err + "```");
                }
            } else {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Calc expresison not provided");
                bot.sendMessage(msg.channel, msg.author + " :rolling_eyes:");
            }
        }
    },
    // Sets a countdown for an event
    "countdown": {
        usage: "<time from now>|<event name>",
        process: function(bot, msg, suffix) {
            if(suffix) {
                if(suffix.indexOf("|")>0 && suffix.length>=3) {
                    var time = parseTime(suffix.substring(0, suffix.indexOf("|")).trim());
                    var event = suffix.substring(suffix.indexOf("|")+1).toLowerCase().trim();
                    if(!time) {
                        logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Invalid time provided for countdown");
                        bot.sendMessage(msg.channel, msg.author + " That's not a valid time. Use the syntax `<no.> <\"s\", \"m\", \"h\", or \"d\">`");
                    } else if(configs.servers[msg.channel.server.id].countdowns[event]) {
                        logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, msg.author.username + " tried to overwrite a countdown");
                        bot.sendMessage(msg.channel, msg.author + " A countdown called `" + suffix.substring(suffix.indexOf("|")+1) + "` already exists. Try a different name.");
                    } else {
                        var timestamp = Date.now() + time.countdown;
                        configs.servers[msg.channel.server.id].countdowns[event] = {
                            timestamp: timestamp,
                            chid: msg.channel.id,
                            name: suffix.substring(suffix.indexOf("|")+1)
                        };
                        setTimeout(function() {
                            if(stats[msg.channel.server.id].botOn[msg.channel.id]) {
                                bot.sendMessage(msg.channel, "3...2...1...**" + suffix.substring(suffix.indexOf("|")+1) + "**");
                                delete configs.servers[msg.channel.server.id].countdowns[event];
                                logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Countdown " + event + " expired");
                            }
                        }, time.countdown);
                        bot.sendMessage(msg.channel, "I gotchu bro, countdown set to expire at " + prettyDate(new Date(timestamp)));
                    }
                } else {
                    if(configs.servers[msg.channel.server.id].countdowns[suffix.toLowerCase()]) {
                        bot.sendMessage(msg.channel, "**" + configs.servers[msg.channel.server.id].countdowns[suffix.toLowerCase()].name + "** set to expire in " + secondsToString((configs.servers[msg.channel.server.id].countdowns[suffix.toLowerCase()].timestamp - Date.now()) / 1000));
                    } else {
                        var info = "Select from one of the following:";
                        var options = [];
                        var count = 0;
                        for(var event in configs.servers[msg.channel.server.id].countdowns) {
                            info += "\n\t" + count + ") " + configs.servers[msg.channel.server.id].countdowns[event].name;
                            options.push(event);
                            count++;
                        }
                        bot.sendMessage(msg.channel, options.length==0 ? ("No countdowns have been started. Use `" + getPrefix(msg.channel.server) + "countdown <time from now>|<event name>` to start one.") : info);
                        if(options.length>0) {
                            selectMenu(msg.channel, msg.author.id, function(i) {
                                bot.sendMessage(msg.channel, "**" + configs.servers[msg.channel.server.id].countdowns[options[i]].name + "** set to expire in " + secondsToString((configs.servers[msg.channel.server.id].countdowns[options[i]].timestamp - Date.now()) / 1000));
                            }, count-1);
                        }
                    }
                }
            } else {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Invalid countdown parameters provided");
                bot.sendMessage(msg.channel, "Huh?");
            }
        }
    },
    // Finds the time in a city
    "time": {
        usage: "<city>",
        process: function(bot, msg, suffix) {
            var location = suffix;
            if(suffix.indexOf("in ")==0) {
                location = suffix.substring(3);
            }
            if(!location) {
                bot.sendMessage(msg.channel, "It's " + prettyDate(new Date()) + " for me");
                return;
            }
            unirest.get("http://maps.googleapis.com/maps/api/geocode/json?address=" + encodeURI(location.replace(/&/g, '')))
            .header("Accept", "application/json")
            .end(function(result) {
                if(result.status==200 && result.body.results.length>0) {
                    location = result.body.results[0].formatted_address;
                    unirest.get("https://maps.googleapis.com/maps/api/timezone/json?location=" + result.body.results[0].geometry.location.lat + "," + result.body.results[0].geometry.location.lng + "&timestamp=865871421&sensor=false")
                    .header("Accept", "application/json")
                    .end(function(result) {
                        var date = new Date(Date.now() + (parseInt(result.body.rawOffset) * 1000) + (parseInt(result.body.dstOffset) * 1000));
                        bot.sendMessage(msg.channel, "It's " + prettyDate(date).slice(0, -4) + " in " + location + " (" + result.body.timeZoneName + ")");
                    });
                } else {
                    logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Invalid timezone city provided");
                    bot.sendMessage(msg.channel, msg.author + " A little birdie told me that place doesn't exist ;)");
                }
            });
        }
    },
    // Fetches a large emoji
    "emoji": {
        usage: "<emoji or name>",
        process: function(bot, msg, suffix) {
            if(!suffix || (!emoji.getName(suffix) && emoji.names.indexOf(suffix.toLowerCase())==-1)) {
                bot.sendFile(msg.channel, "http://emoji.fileformat.info/gemoji/tired_face.png");
            } else if(emoji.names.indexOf(suffix.toLowerCase())>-1) {
                bot.sendFile(msg.channel, "http://emoji.fileformat.info/gemoji/" + suffix.toLowerCase() + ".png", function(err) {
                    bot.sendFile(msg.channel, "http://emoji.fileformat.info/gemoji/tired_face.png");
                });
            } else {
                bot.sendFile(msg.channel, "http://emoji.fileformat.info/gemoji/" + emoji.getName(suffix) + ".png", function(err) {
                    bot.sendFile(msg.channel, "http://emoji.fileformat.info/gemoji/tired_face.png");
                });
            }
        }
    },
    // Generates a dank new meme
    "meme": {
        usage: "<image name>|<top text>|<bottom text>",
        process: function(bot, msg, suffix) {
            if(suffix && suffix.split("|").length==3) {
                var name = suffix.split("|")[0];
                var top = suffix.split("|")[1];
                var bottom = suffix.split("|")[2];
                if(!name || !top || !bottom) {
                    logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, msg.author.username + " did not provide proper syntax for meme");
                    bot.sendMessage(msg.channel, "http://i.imgur.com/IHqy8l6.jpg");
                } else {
                    var found = false;
                    for(var i=0; i<memes.length; i++) {
                        if(levenshtein.get(name.toLowerCase(), memes[i].toLowerCase())<3) {
                            name = memes[i];
                            found = true;
                            break;
                        }
                    }
                    if(found) {
                        var url = "http://apimeme.com/meme?meme=" + encodeURI(name.replace(/&/g, '')) + "&top=" + encodeURI(top.replace(/&/g, '')) + "&bottom=" + encodeURI(bottom.replace(/&/g, ''));
                        base64.encode(url, {filename: "meme.jpg"}, function(error, image) {
                            if(!error) {
                                bot.sendFile(msg.channel, image);
                            } else {
                                bot.sendMessage(msg.channel, url);
                            }
                        });
                    } else {
                        logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Meme '" + name + "' not found");
                        bot.sendMessage(msg.channel, "http://i.imgur.com/theaeKM.png");
                    }
                }
            } else {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, msg.author.username + " did not provide proper syntax for meme");
                bot.sendMessage(msg.channel, "http://i.imgur.com/5VKP1Yj.gifv");
            }
        }
    },
    // Pokedex search
    "pokedex": {
        usage: "<National Dex number>",
        process: function(bot, msg, suffix) {
            if(suffix || isNaN(suffix)) {
                unirest.get("http://pokeapi.co/api/v2/pokemon-species/" + suffix)
                .header("Accept", "application/json")
                .end(function(response) {
                    if(response.status==200) {
                        var data = response.body;
                        var info = "__Pokemon #" + data.id + ": " + data.names[0].name + "__\n";
                        if(data.gender_rate==-1) {
                            info += "**Genderless**\n";
                        } else {
                            info += "**Gender Ratio:** " + (data.gender_rate * 12.5) + "% female and " + (100 - data.gender_rate) * 12.5 + "% male\n";
                        }
                        info += "**Capture Rate:** " + data.capture_rate + " of 255 (higher is better)\n**Base Happiness:** " + data.base_happiness + "\n**Base Steps to Hatch:** " + (data.hatch_counter * 255 + 1) + "\n**Growth Rate:** " + data.growth_rate.name + "\n**Color/Shape:** " + data.color.name + " " + data.shape.name + "\n**Habitat:** " + (data.habitat ? data.habitat.name : "None") + "\n**First Seen in Generation:** " + data.generation.name.substring(data.generation.name.indexOf("-")+1).toUpperCase();
                        bot.sendMessage(msg.channel, info);
                    } else {
                        logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to fetch pokedex data");
                        bot.sendMessage(msg.channel, "")
                    }
                });
            } else {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "User did not provide valid pokedex number");
                bot.sendMessage(msg.channel, msg.author + " :speak_no_evil: :writing_hand: :1234:")
            }
        }
    },
    // Searches anime
    "anime": {
        usage: "<query> [<count>]",
        process: function(bot, msg, suffix) {
            if(suffix) {
                var query = suffix.substring(0, suffix.lastIndexOf(" "));
                var count = parseInt(suffix.substring(suffix.lastIndexOf(" ")+1));

                if(query=="" || !query || isNaN(count)) {
                    query = suffix;
                    count = configs.servers[msg.channel.server.id].defaultcount;
                }
                if(count<1 || count>configs.servers[msg.channel.server.id].maxcount) {
                    count = configs.servers[msg.channel.server.id].defaultcount;
                }
                unirest.get("http://hummingbird.me/api/v1/search/anime?query=" + encodeURI(query.replace(/&/g, '')))
                .header("Accept", "application/json")
                .end(function(result) {
                    if(result.status==200 && result.body.length>0) {
                        var results = [];
                        for(var i=0; i<count; i++) {
                            if(i>=result.body.length) {
                                break;
                            }
                            var info = "__**" + result.body[i].title + "**__```" + result.body[i].synopsis + "```**Status:** " + result.body[i].status + "\n**Episodes:** " + result.body[i].episode_count + "\n**Length:** " + result.body[i].episode_length + " minutes" + (result.body[i].age_rating ? ("\n**Age Rating:** " + result.body[i].age_rating) : "") + "\n**Type:** " + result.body[i].show_type + "\n**Rating:** " + (Math.round(result.body[i].community_rating * 10)/10) + "\n**Genres:**";
                            for(var j=0; j<result.body[i].genres.length; j++) {
                                info += "\n\t" + result.body[i].genres[j].name;
                            }
                            info += (result.body[i].started_airing ? ("\n**Started Airing:** " + result.body[i].started_airing) : "") + (result.body[i].finished_airing ? ("\n**Finished Airing:** " + result.body[i].finished_airing) : "") + "\n" + result.body[i].url;
                            results.push(info);
                        }
                        var select = selectMenu(msg.channel, msg.author.id, function(i) {
                            bot.sendMessage(msg.channel, results[i]);
                        }, results.length-1);
                        if(select) {
                            var info = "Select one of the following:\n";
                            for(var i=0; i<results.length; i++) {
                                info += "\t" + i + ") " + results[i].substring(4, results[i].substring(4).indexOf("**")) + "\n";
                            }
                            bot.sendMessage(msg.channel, info);
                        } else {
                            sendArray(msg.channel, results);
                        }
                    } else {
                        logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "No anime found for '" + query + "'");
                        bot.sendMessage(msg.channel, "Nope, no anime found.");
                    }
                });
            } else {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "No anime search parameters");
                bot.sendMessage(msg.channel, msg.author + " Empty anime? Is that what you want?");
            }
        }
    },
    // Searches manga
    "manga": {
        usage: "<query> [<count>]",
        process: function(bot, msg, suffix) {
            if(suffix) {
                var query = suffix.substring(0, suffix.lastIndexOf(" "));
                var count = parseInt(suffix.substring(suffix.lastIndexOf(" ")+1));

                if(query=="" || !query || isNaN(count)) {
                    query = suffix;
                    count = configs.servers[msg.channel.server.id].defaultcount;
                }
                if(count<1 || count>configs.servers[msg.channel.server.id].maxcount) {
                    count = configs.servers[msg.channel.server.id].defaultcount;
                }

                var results = [];
                for(var i=0; i<manga.length; i++) {
                    if(results.length>=count) {
                        break;
                    }
                    if(manga[i].t.toLowerCase().indexOf(query.toLowerCase())>-1) {
                        results.push([manga[i].t, manga[i].i]);
                    }
                }
                if(results.length==0) {
                    logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "No manga found for '" + query + "'");
                    bot.sendMessage(msg.channel, "Nope, no manga found.");
                } else {
                    selectMenu(msg.channel, msg.author.id, function(i) {
                        unirest.get("https://www.mangaeden.com/api/manga/" + results[i][1])
                        .header("Accept", "application/json")
                        .end(function(result) {
                            if(result.status==200) {
                                bot.sendMessage(msg.channel, "__**" + result.body.title + "**__```" + result.body.description.replace(/&/g, "&amp;").replace(/>/g, "&gt;").replace(/</g, "&lt;").replace(/"/g, "&quot;") + "```**Chapters:** " + result.body.chapters_len + "\n**Author:** " + result.body.author + "\n**Artist:** " + result.body.artist + "\n**Released:** " + result.body.released + "\n**Genres:**\n\t" + result.body.categories.join("\n\t") + "\n" + result.body.url);
                            } else {
                                logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to fetch manga " + results[i][0]);
                                bot.sendMessage(msg.channel, "Uh-oh, something is wrong with this mango.");
                            }
                        });
                    }, results.length-1);
                    var info = "Select one of the following:";
                    for(var i=0; i<results.length; i++) {
                        var tmpinfo = "\n\t" + i + ") " + results[i][0];
                        if((tmpinfo.length + info.length)>2000) {
                            break;
                        } else {
                            info += tmpinfo;
                        }
                    }
                    bot.sendMessage(msg.channel, info);
                }
            } else {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "No manga search parameters");
                bot.sendMessage(msg.channel, msg.author + " Empty manga? Is that what you want?");
            }
        }
    },
    // Chooses from a set of options
    "choose": {
        usage: "<option 1>|<option 2>|...",
        process: function(bot, msg, suffix) {
            if(suffix && suffix.split("|").length>=2) {
                bot.sendMessage(msg.channel, suffix.split("|")[getRandomInt(0, suffix.split("|").length-1)]);
            } else {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, msg.author.username + " did not provide proper syntax for choose");
                bot.sendMessage(msg.channel, msg.author + " :thinking: I didn't quite get that. Make sure to use the syntax `choose <option 1>|<option 2>|...`");
            }
        }
    },
    // Messages the mods
    "alert": {
        usage: "<message>",
        process: function(bot, msg, suffix) {
            var message = " sent an alert in #" + msg.channel.name + " on " + msg.channel.server.name;
            if(suffix) {
                message += ": " + suffix;
            }
            adminMsg(false, msg.channel.server, msg.author, message);
            bot.sendMessage(msg.channel, "The admins have been alerted!");
        }
    },
    // Database of easily accessible responses
    "tag": {
        usage: "<key or \"clear\">[|<value>][|command]",
        process: function(bot, msg, suffix) {
            if(suffix.indexOf("|")>-1) {
                var key = suffix.substring(0, suffix.indexOf("|")).toLowerCase().trim();
                var value = suffix.substring(suffix.indexOf("|")+1).trim();
                if(!key || !value) {
                    logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, msg.author.username + " did not provide proper key and value for tag command");
                    bot.sendMessage(msg.channel, msg.author + " `" + getPrefix(msg.channel.server) + "tag <key>|<value>` is the syntax I need");
                } else if((configs.servers[msg.channel.server.id].tags[key] || emotes[key]) && value!=".") {
                    logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, msg.author.username + " tried to set tag key that already exists");
                    bot.sendMessage(msg.channel, msg.author + " I already have a tag set for that. Try `" + getPrefix(msg.channel.server) + "tag " + key + "|.` to remove it");
                } else if(configs.servers[msg.channel.server.id].tags[key] && value==".") {
                    if(configs.servers[msg.channel.server.id].admins.indexOf(msg.author.id)==-1 && (configs.servers[msg.channel.server.id].lockedtags.indexOf(key)>-1 || configs.servers[msg.channel.server.id].removetagadmin || (configs.servers[msg.channel.server.id].tagcommands.indexOf(key)>-1 && configs.servers[msg.channel.server.id].removetagcommandadmin))) {
                        logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, msg.author.username + " tried to remove a tag but is not an admin");
                        bot.sendMessage(msg.channel, msg.author + " Are you an admin? Last time I checked you weren't.");
                        return;
                    }
                    delete configs.servers[msg.channel.server.id].tags[key];
                    if(configs.servers[msg.channel.server.id].tagcommands.indexOf(key)>-1) {
                        configs.servers[msg.channel.server.id].tagcommands.splice(configs.servers[msg.channel.server.id].tagcommands.indexOf(key), 1);
                    }
                    if(configs.servers[msg.channel.server.id].lockedtags.indexOf(key)>-1) {
                        configs.servers[msg.channel.server.id].lockedtags.splice(configs.servers[msg.channel.server.id].lockedtags.indexOf(key), 1);
                    }
                    logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Deleted tag '" + key + "'");
                    bot.sendMessage(msg.channel, "Deleted.");
                } else if(configs.servers[msg.channel.server.id].tags[key] && value.toLowerCase()=="lock") {
                    if(configs.servers[msg.channel.server.id].admins.indexOf(msg.author.id)>-1) {
                        if(configs.servers[msg.channel.server.id].lockedtags.indexOf(key)==-1) {
                            var action = "Locked";
                            configs.servers[msg.channel.server.id].lockedtags.push(key);
                        } else {
                            var action = "Unlocked";
                            configs.servers[msg.channel.server.id].lockedtags.splice(configs.servers[msg.channel.server.id].lockedtags.indexOf(key), 1);
                        }
                        logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, action + " tag '" + key + "'");
                        bot.sendMessage(msg.channel, "Cool cool");
                    } else {
                        logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, msg.author.username + " tried to set lock a tag but is not an admin");
                        bot.sendMessage(msg.channel, msg.author + " Check ur priv bruh");
                    }
                } else {
                    if(configs.servers[msg.channel.server.id].admins.indexOf(msg.author.id)==-1 && configs.servers[msg.channel.server.id].addtagadmin) {
                        logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, msg.author.username + " tried to add a tag but is not an admin");
                        bot.sendMessage(msg.channel, msg.author + " Are you an admin? Last time I checked you weren't.");
                        return;
                    }
                    if(value.toLowerCase().indexOf("|command")==value.length-8) {
                        if(configs.servers[msg.channel.server.id].admins.indexOf(msg.author.id)==-1 && configs.servers[msg.channel.server.id].addtagcommandadmin) {
                            logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, msg.author.username + " tried to add a tag command but is not an admin");
                            bot.sendMessage(msg.channel, msg.author + " Check ur priv bruh");
                            return;
                        }
                        if(checkCommandConflicts(key, msg.channel.server)) {
                            logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, msg.author.username + " tried to set tag command key that already exists");
                            bot.sendMessage(msg.channel, msg.author + " I can't set that tag command because it's a default command!");
                            return;
                        } else if(key.indexOf(" ")>-1) {
                            logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, msg.author.username + " tried to set tag command with spaces");
                            bot.sendMessage(msg.channel, msg.author + " Tag commands can't have spaces...");
                            return;
                        }
                        configs.servers[msg.channel.server.id].tagcommands.push(key);
                        value = value.substring(0, value.toLowerCase().indexOf("|command"));
                    }
                    configs.servers[msg.channel.server.id].tags[key] = value;
                    logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Set new tag '" + key + "'");
                    bot.sendMessage(msg.channel, "Cool! *memesmemesmemes*");
                }
            } else if(suffix.toLowerCase()=="clear") {
                if(configs.servers[msg.channel.server.id].admins.indexOf(msg.author.id)>-1) {
                    configs.servers[msg.channel.server.id].tags = {};
                    logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Cleared all tags at admin's request");
                    bot.sendMessage(msg.channel, "RIP.");
                } else {
                    logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "User is not a bot admin and cannot clear tags");
                    bot.sendMessage(msg.channel, msg.author + " Only my friends can do that.");
                }
            } else if(configs.servers[msg.channel.server.id].tags[suffix.toLowerCase()]) {
                bot.sendMessage(msg.channel, configs.servers[msg.channel.server.id].tags[suffix.toLowerCase()]);
            } else if(emotes[suffix.toLowerCase()]) {
                bot.sendFile(msg.channel, "http://emote.3v.fi/2.0/" + emotes[suffix.toLowerCase()] + ".png");
            } else if(!suffix) {
                var info = [""];
                var index = 0;
                for(var tag in configs.servers[msg.channel.server.id].tags) {
                    var tmpinfo = "**" + tag + "**: " + configs.servers[msg.channel.server.id].tags[tag] + "\n";
                    if((tmpinfo.length + info[index].length)>2000) {
                        index++;
                        info[index] = "";
                    } 
                    info[index] += tmpinfo;
                }
                if(!info[0]) {
                    info = ["No tags found for this server. Use `" + getPrefix(msg.channel.server) + "tag <key>|<value>` to set one."];
                }
                sendArray(msg.channel, info);
            } else {
                var info = "Select one of the following options:";
                for(var i=0; i<Object.keys(configs.servers[msg.channel.server.id].tags).length; i++) {
                    var tmpinfo = "\n\t" + i + ") " + Object.keys(configs.servers[msg.channel.server.id].tags)[i];
                    if((tmpinfo.length + info.length)>2000) {
                        break;
                    } else {
                        info += tmpinfo;
                    }
                }
                bot.sendMessage(msg.channel, info);
                selectMenu(msg.channel, msg.author.id, function(i) {
                    bot.sendMessage(msg.channel, configs.servers[msg.channel.server.id].tags[Object.keys(configs.servers[msg.channel.server.id].tags)[i]]);
                }, Object.keys(configs.servers[msg.channel.server.id].tags).length-1);
            }
        }
    },
    // Sets an AFK message for this server
    "afk": {
        usage: "<message>",
        process: function(bot, msg, suffix) {
            if(!suffix) {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, msg.author.username + " did not provide AFK message");
                bot.sendMessage(msg.channel, msg.author + " What message should I send when you're AFK? Use the syntax `afk <message>`");
            } else if(suffix==".") {
                if(stats[msg.channel.server.id].members[msg.author.id]) {
                    delete stats[msg.channel.server.id].members[msg.author.id].AFK;
                    logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Removed AFK message for " + msg.author.username);
                    bot.sendMessage(msg.channel, msg.author + " OK, I won't show that message anymore.");
                } else {
                    logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, msg.author.username + " tried to delete nonexistent AFK message");
                    bot.sendMessage(msg.channel, msg.auhtor + " I didn't have an AFK message set for you in the first place. Use `afk <message>`");
                }
            } else {
                checkStats(msg.author.id, msg.channel.server.id);
                stats[msg.channel.server.id].members[msg.author.id].AFK = suffix;
                logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Set AFK message for " + msg.author.username);
                bot.sendMessage(msg.channel, msg.author + " Thanks, I'll show that if/when someone tags you in a server. Reply with `" + getPrefix(msg.channel.server) + "afk .` when you come back :)");
            }
        }
    },
    // DuckDuckGo Instant Answers
    "ddg": {
        usage: "<query>",
        process: function(bot, msg, suffix) {
            if(suffix) {
                unirest.get("http://api.duckduckgo.com/?format=json&q=" + encodeURI(suffix.replace(/&/g, '')))
                .header("Accept", "application/json")
                .end(function(result) {

                    if(result.status==200 && JSON.parse(result.body).Results.length>0 && JSON.parse(result.body).AbstractText) {
                        bot.sendMessage(msg.channel, "```" + JSON.parse(result.body).AbstractText + "```" + JSON.parse(result.body).Results[0].FirstURL);
                    } else {
                        logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "No DDG answer for '" + suffix + "'");
                        bot.sendMessage(msg.channel, "DuckDuckGo can't answer that. Maybe try Google? :wink:");
                    }
                });
            } else {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "No parameters provided for ddg command");
                bot.sendMessage(msg.channel, msg.author + " Wtf am I supposed to do with that? #rekt");
            }
        }
    },
    // Searches Google for a given query
    "search": {
        usage: "<query> [<count>]",
        process: function(bot, msg, suffix) {
            if(suffix) {
                var query = suffix.substring(0, suffix.lastIndexOf(" "));
                var count = parseInt(suffix.substring(suffix.lastIndexOf(" ")+1));

                if(!query || isNaN(count)) {
                    query = suffix;
                }
                if((!count || count<0 || count>configs.servers[msg.channel.server.id].maxcount) && count!=0) {
                    count = configs.servers[msg.channel.server.id].defaultcount;
                }
                unirest.get("https://kgsearch.googleapis.com/v1/entities:search?query=" + encodeURI(query.replace(/&/g, '')) + "&key=" + (configs.servers[msg.channel.server.id].customkeys.google_api_key || AuthDetails.google_api_key) + "&limit=1&indent=True")
                .header("Accept", "application/json")
                .end(function(result) {
                    var doSearch = function() {
                        var options = {
                            query: query,
                            limit: count
                        };
                        var i = 0;
                        searcher.search(options, function(err, url) {
                            if(!err) {
                                urlInfo(url, function(error, linkInfo) {
                                    if(i<count) {
                                        i++;
                                        if(!error) {
                                            bot.sendMessage(msg.channel, "**" + linkInfo.title + "**\n" + url + "\n");
                                        } else {
                                            bot.sendMessage(msg.channel, url + "\n");
                                        }
                                    }
                                });
                            } else {
                                logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to search for '" + query + "'");
                                bot.sendMessage(msg.channel, "Oops, something went wrong!!");
                            }
                        });
                    }
                    if(result.status==200 && result.body.itemListElement[0] && result.body.itemListElement[0].result && result.body.itemListElement[0].result.detailedDescription) {
                        bot.sendMessage(msg.channel, "```" + result.body.itemListElement[0].result.detailedDescription.articleBody + "```" + result.body.itemListElement[0].result.detailedDescription.url, function() {
                            if(count>0) {
                                doSearch();
                            }
                        });
                    } else if(count>0) {
                        doSearch();
                    }
                });
            } else {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "No search parameters");
                bot.sendMessage(msg.channel, msg.author + " ???");
            }
        }
    },
    // Gets TV and movie data from IMDB
    "imdb": {
        usage: "[<\"series\", \"episode\", or \"movie\">] <query>",
        process: function(bot, msg, suffix) {
            var query = suffix;
            var type = "";
            if(query.toLowerCase().indexOf("series ")==0 || query.toLowerCase().indexOf("episode ")==0 || query.toLowerCase().indexOf("movie ")==0) {
                type = "&type=" + query.substring(0, query.indexOf(" ")).toLowerCase();
                query = query.substring(query.indexOf(" ")+1);
            }
            if(query) {
                unirest.get("http://www.omdbapi.com/?t=" + encodeURI(query.replace(/&/g, '')) + "&r=json" + type)
                .header("Accept", "application/json")
                .end(function(result) {
                    if(result.status==200 && result.body.Response=="True") {
                        bot.sendMessage(msg.channel, "__**" + result.body.Title + (type ? "" : (" (" + result.body.Type.charAt(0).toUpperCase() + result.body.Type.slice(1) + ")")) + "**__```" + result.body.Plot + "```**Year:** " + result.body.Year + "\n**Rated:** " + result.body.Rated + "\n**Runtime:** " + result.body.Runtime + "\n**Actors:**\n\t" + result.body.Actors.replaceAll(", ", "\n\t") + "\n**Director:** " + result.body.Director + "\n**Writer:** " + result.body.Writer + "\n**Genre(s):**\n\t" + result.body.Genre.replaceAll(", ", "\n\t") + "\n**Rating:** " + result.body.imdbRating + " out of " + result.body.imdbVotes + " votes\n**Awards:** " + result.body.Awards + "\n**Country:** " + result.body.Country + "\nhttp://www.imdb.com/title/" + result.body.imdbID + "/");
                    } else {
                        logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "No IMBD entries for '" + query + "'");
                        bot.sendMessage(msg.channel, ":no_mouth: :no_entry_sign:");
                    }
                });
            } else {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Invalid IMDB parameters");
                bot.sendMessage(msg.channel, msg.author + " U WOT M8");
            }
        }
    },
    // Fetches Twitter user timelines
    "twitter": {
        usage: "<username> [<count>]",
        process: function(bot, msg, suffix) {
            if(suffix) {
                var user = suffix.substring(0, suffix.indexOf(" "));
                var count = parseInt(suffix.substring(suffix.indexOf(" ")+1));

                if(user=="" || !user || isNaN(count)) {
                    user = suffix;
                }
                if(!count || count<1 || count>configs.servers[msg.channel.server.id].maxcount) {
                    count = configs.servers[msg.channel.server.id].defaultcount;
                }
                getRSS(msg.channel.server.id, "http://twitrss.me/twitter_user_to_rss/?user=" + user, count, function(err, articles) {
                    if(err) {
                        logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Twitter user " + user + " not found");
                        bot.sendMessage(msg.channel, msg.author + " Twitter user `" + user + "` not found. Make sure not to include the `@`");
                    } else {
                        var info = "";
                        for(var i=0; i<articles.length; i++) {
                            var tmpinfo = "`" + prettyDate(articles[i].published) + "` " + articles[i].link + "\n";
                            if((tmpinfo.length + info.length)>2000) {
                                break;
                            } else {
                                info += tmpinfo;
                            }
                        }
                        bot.sendMessage(msg.channel, info);
                    }
                });
            } else {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Twitter parameters not provided");
                bot.sendMessage(msg.channel, msg.author + " You confuse me.");
            }
        }
    },
    // Gets YouTube link with given keywords
    "youtube": {
        usage: "<video tags>",
        process: function(bot, msg, suffix) {
            if(!suffix) {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "User did not provide search term(s)");
                bot.sendMessage(msg.channel, msg.author + " What should I search YouTube for?");
                return;
            }
            ytSearch(suffix, msg.channel.server.id, function(link) {
                bot.sendMessage(msg.channel, link);
            });
        }
    },
    // New Year Countdown
    "year": {
        process: function(bot, msg) {
            var a = new Date();
            var e = new Date(a.getFullYear()+1, 0, 1, 0, 0, 0, 0);
            var info = secondsToString((e-a)/1000) + "until " + (a.getFullYear()+1) + "!";
            bot.sendMessage(msg.channel, info);
        }
    },
    // Admin-only: kick user
    "kick": {
        usage: "<username>",
        process: function(bot, msg, suffix) {
            var usr = userSearch(suffix, msg.channel.server);
            if(!suffix || !usr || [msg.author.id, bot.user.id].indexOf(usr.id)>-1) {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Error using kick command");
                bot.sendMessage(msg.channel, "Do you want me to kick you? :open_mouth:");
            } else {
                bot.kickMember(usr, msg.channel.server, function(err) {
                    if(err) {
                        logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to kick " + usr.username);
                        bot.sendMessage(msg.channel, "I don't have permission to kick on this server :sob:");
                    } else {
                        bot.sendMessage(msg.channel, "kk");
                    }
                });
            }
        }
    },
    // Admin-only: ban user
    "ban": {
        usage: "<username>",
        process: function(bot, msg, suffix) {
            var usr = userSearch(suffix, msg.channel.server);
            if(!suffix || !usr || [msg.author.id, bot.user.id].indexOf(usr.id)>-1) {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Error using ban command");
                bot.sendMessage(msg.channel, "Do you want me to ban you? :open_mouth:");
            } else {
                bot.banMember(usr, msg.channel.server, function(err) {
                    if(err) {
                        logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to ban " + usr.username);
                        bot.sendMessage(msg.channel, "I don't have permission to ban on this server :sob:");
                    } else {
                        bot.sendMessage(msg.channel, "kk");
                    }
                });
            }
        }
    },
    // Mutes or unmutes a user
    "mute": {
        usage: "<username>",
        process: function(bot, msg, suffix) {
            var usr = userSearch(suffix, msg.channel.server);
            if(!suffix || !usr || [msg.author.id, bot.user.id].indexOf(usr.id)>-1) {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Error using mute command");
                bot.sendMessage(msg.channel, "Do you want me to mute you? :open_mouth:");
            } else {
                muteUser(msg.channel, usr, function(err, state) {
                    if(err) {
                        logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to " (state ? "mute " : "unmute ") + usr.username);
                        bot.sendMessage(msg.channel, "I don't have permission to mute on this server :sob:");
                    } else {
                        bot.sendMessage(msg.channel, "Alright, done. **@" + getName(msg.channel.server, usr) + "** has been " + (state ? "muted :mute:" : "unmuted :sound:") + " in this channel.");
                    }
                });
            }
        }
    },
    // Archive n messages in this channel
    "archive": {
        usage: "<no. of messages>",
        process: function(bot, msg, suffix) {
            if(!suffix || isNaN(suffix)) {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Number of messages to archive not provided");
                bot.sendMessage(msg.channel, msg.author + " I'll need a number with that, please.");
            } else {
                archiveMessages(msg.channel, suffix, function(err, archive) {
                    if(err) {
                        bot.sendMessage(msg.channel, "Damn, Discord gave me some trouble with that. Ask the mods to give me message history permissions.");
                    } else {
                        var filename = "./" + msg.channel.id + "-" + genToken(8) + ".json";
                        fs.writeFile(filename, JSON.stringify(archive, null, 4), function(err) {
                            if(err) {
                                logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to write temporary archive");
                                bot.sendMessage(msg.channel, "Errors, errors, errors :(");
                            } else {
                                bot.sendFile(msg.channel, filename, msg.channel.server.name + "-" + msg.channel.name + "-" + Date.now() + ".json", function(err) {
                                    if(err) {
                                        logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to send archive");
                                        bot.sendMessage(msg.channel, "Discord is getting mad at me. Try a smaller number of messages.");
                                    }
                                    fs.unlink(filename, function(err) {
                                        logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to delete temporary archive");
                                    });
                                });
                            }
                        });
                    }
                });
            }
        }
    },
    // Bulk delete messages
    "nuke": {
        usage: "<no. of messages> [<username>]",
        process: function(bot, msg, suffix) {
            var usr;
            var num = suffix;
            if(suffix.indexOf(" ")>-1) {
                num = suffix.substring(0, suffix.indexOf(" "));
                usr = userSearch(suffix.substring(suffix.indexOf(" ")+1), msg.channel.server);
                if(!usr) {
                    logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Invalid user provided to nuke");
                    bot.sendMessage(msg.channel, msg.author + " That user doesn't exist. Use this command without a username to delete messages from everyone.");
                    return;
                }
            }
            if(!num || isNaN(num)) {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Invalid number of messages provided to nuke");
                bot.sendMessage(msg.channel, msg.author + " Make sure to use the syntax `nuke <no. of messages> [<username>]`");
                return;
            }
            if(num<=1) {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Number of messages to nuke provided is less than 2");
                bot.sendMessage(msg.channel, msg.author + " I must delete at least 2 messages.");
                return;
            }
            cleanMessages(msg.channel, usr, num, function(err) {
                if(err) {
                    bot.sendMessage(msg.channel, "I couldn't nuke this channel. Are ya sure I have powers?");
                } else {
                    bot.sendMessage(msg.channel, ":fire:");
                }
            });
        }
    },
    // Says something
    "say": {
        usage: "<something>",
        process: function(bot, msg, suffix) {
            if(!suffix) {
                bot.sendMessage(msg.channel, "\t\n");
            } else {
                bot.sendMessage(msg.channel, suffix);
            }
        }
    },
    // Searches Google Images with keyword(s)
    "image": {
        usage: "<image tags> [random]",
        process: function(bot, msg, suffix) {
            var num = "";
            if(!suffix) {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "User did not provide search term(s)");
                bot.sendMessage(msg.channel, msg.author + " I don't know what image to get...");
                return;
            } else if(suffix.substring(suffix.lastIndexOf(" ")+1).toLowerCase()=="random") {
                if(suffix.substring(0, suffix.lastIndexOf(" "))) {
                    suffix = suffix.substring(0, suffix.lastIndexOf(" "));
                    num = getRandomInt(0, 19);
                }
            }
            giSearch(suffix, num, msg.channel.server.id, msg.channel.id, function(img) {
                if(img==false) {
                    bot.sendMessage(msg.channel, "Looks like we've hit the daily Google Image Search API rate limit, folks! Sorry about that.");
                } else if(img==null) {
                    bot.sendMessage(msg.channel, "Couldn't find anything, sorry");
                } else {
                    bot.sendMessage(msg.channel, img);
                }
            });
        }
    },
    // Get GIF from Giphy
    "gif": {
		usage: "<GIF tags>",
		process: function(bot, msg, suffix) {
            if(!suffix) {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "User did not provide GIF search term(s)");
                bot.sendMessage(msg.channel, msg.author + " I don't know of a GIF for nothing.");
                return;
            }
		    var tags = suffix.split(" ");
            var rating = "pg-13";
            if(!configs.servers[msg.channel.server.id].nsfwfilter[0] || configs.servers[msg.channel.server.id].nsfwfilter[1].indexOf(msg.channel.id)>-1 || !configs.servers[msg.channel.server.id].servermod) {
                rating = "r";
            }
		    getGIF(tags, rating, function(id) {
                if(id) {
                    bot.sendMessage(msg.channel, "http://media.giphy.com/media/" + id + "/giphy.gif");
                } else {
                    logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "GIF not found for " + suffix);
                    bot.sendMessage(msg.channel, "The Internet has run out of memes :/");
                }
		    });
		}
	},
    // Predicts the answer to a question
    "8ball": {
        usage: "<question>",
        process: function(bot, msg, suffix) {
            if(suffix) {
                unirest.get("https://8ball.delegator.com/magic/JSON/" + encodeURI(suffix.replace(/&/g, '')))
                .header("Accept", "application/json")
                .end(function(result) {
                    if(result.status==200) {
                        bot.sendMessage(msg.channel, "```" + result.body.magic.answer + "```");
                    } else {
                        logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to fetch 8ball answer");
                        bot.sendMessage(msg.channel, "Broken 8ball :(");
                    }
                });
            } else {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "No parameters provided for 8ball command");
                bot.sendMessage(msg.channel, msg.author + " You tell me... :P");
            }
        }
    },
    // Tells your fortune
    "fortune": {
        usage: "[<category>]",
        process: function(bot, msg, suffix) {
            var categories = ["all", "computers", "cookie", "definitions", "miscellaneous", "people", "platitudes", "politics", "science", "wisdom"];
            if(suffix && categories.indexOf(suffix.toLowerCase())==-1) {
                var info = "Select one of the following:";
                for(var i=0; i<categories.length; i++) {
                    info += "\n\t" + i + ") " + categories[i].charAt(0) + categories[i].slice(1);
                }
                bot.sendMessage(msg.channel, info);
                selectMenu(msg.channel, msg.author.id, function(i) {
                    commands.fortune.process(bot, msg, categories[i]);
                }, categories.length-1);
            } else {
                unirest.get("http://yerkee.com/api/fortune/" + (suffix || ""))
                .header("Accept", "application/json")
                .end(function(result) {
                    if(result.status==200) {
                        bot.sendMessage(msg.channel, result.body.fortune);
                    } else {
                        logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to fetch fortune");
                        bot.sendMessage(msg.channel, "I honestly don't know :neutral_face:");
                    }
                });
            }
        }
    },
    // Random image of a cat
    "cat": {
        process: function(bot, msg) {
            unirest.get("http://random.cat/meow")
            .end(function(result) {
                var image = "http://i.imgur.com/Bai6JTL.jpg";
                if(result.status==200) {
                    image = result.body;
                }
                try {
                    bot.sendFile(msg.channel, image, function(err) {
                        if(err) {
                            bot.sendMessage(msg.channel, image);
                        }
                    });
                } catch(err) {
                    bot.sendMessage(msg.channel, image);
                }
            });
        }
    },
    // Random fact about cats
    "catfact": {
        usage: "[<count>]",
        process: function(bot, msg, suffix) {
            var count = suffix;
            if(!count) {
                count = 1;
            }
            if(isNaN(count) || count<1 || count>configs.servers[msg.channel.server.id].maxcount) {
                count = configs.servers[msg.channel.server.id].defaultcount;
            }
            unirest.get("http://catfacts-api.appspot.com/api/facts?number=" + count)
            .header("Accept", "application/json")
            .end(function(result) {
                if(result.status==200) {
                    sendArray(msg.channel, JSON.parse(result.body).facts);
                } else {
                    logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to fetch cat fact");
                    bot.sendMessage(msg.channel, "Cats exist and are cute af.");
                }
            });
        }
    },
    "numfact": {
        usage: "[<no.>]",
        process: function(bot, msg, suffix) {
            var num = suffix || "random";
            if(suffix && isNaN(suffix)) {
                logMsg(Date.now(), "WANR", msg.channel.server.id, msg.channel.id, msg.author.username + " provided an invalid number for numfact command");
                bot.sendMessage(msg.channel, "`" + suffix + "` is not a number!");
                return;
            }
            unirest.get("http://numbersapi.com/" + num)
            .end(function(result) {
                if(result.status==200) {
                    bot.sendMessage(msg.channel, result.body);
                } else {
                    logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to fetch num fact");
                    bot.sendMessage(msg.channel, "Oh no! Something went wrong.");
                }
            });
        }
    },
    // Searches by tag on e621.net
    "e621": {
        usage: "<tags>",
        process: function(bot, msg, suffix) {
            if(suffix) {
                var query = suffix.substring(0, suffix.lastIndexOf(" "));
                var count = suffix.substring(suffix.lastIndexOf(" ")+1);

                if(!query || isNaN(count)) {
                    query = suffix;
                }
                if(!count || count<1 || count>configs.servers[msg.channel.server.id].maxcount) {
                    count = configs.servers[msg.channel.server.id].defaultcount;
                }

                unirest.get("https://e621.net/post/index.json?tags=" + encodeURI(query.replace(/&/g, '')) + "&limit=" + count)
                .headers({
                  "Accept": "application/json",
                  "User-Agent": "Unirest Node.js"
                })
                .end(function(result) {
                    if(result.status==200) {
                        var info = [];
                        for(var i=0; i<result.body.length; i++) {
                            info.push((result.body[i].description ? ("```" + result.body[i].description + "```") : "") + "**Author:** " + result.body[i].author + "\n**Rating:** " + result.body[i].rating.toUpperCase() + "\n**Score:** " + result.body[i].score + "\n**Favorites:** " + result.body[i].fav_count + "\n" + result.body[i].file_url);
                        }
                        sendArray(msg.channel, info);
                    } else {
                        logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to fetch e621 results");
                        bot.sendMessage(msg.channel, "I'm so sorry, e621 has failed me  :'(");
                    }
                });
            } else {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "No parameters provided for e621 command");
                bot.sendMessage(msg.channel, msg.author + " I need some tags to search for, yo!");
            }
        }
    },
    // Searches by tag on rule32.xxx
    "rule34": {
        usage: "<tags>",
        process: function(bot, msg, suffix) {
            if(suffix) {
                var query = suffix.substring(0, suffix.lastIndexOf(" "));
                var count = parseInt(suffix.substring(suffix.lastIndexOf(" ")+1));

                if(!query || isNaN(count)) {
                    query = suffix;
                }
                if(!count || count<1 || count>configs.servers[msg.channel.server.id].maxcount) {
                    count = configs.servers[msg.channel.server.id].defaultcount;
                }

                unirest.get("http://rule34.xxx/index.php?page=dapi&s=post&q=index&tags=" + encodeURI(query.replace(/&/g, '')) + "&limit=" + count)
                .end(function(result) {
                    if(result.status==200) {
                        result.body = xmlparser(result.body).root.children;
                        var info = [];
                        for(var i=0; i<result.body.length; i++) {
                            info.push("**Rating:** " + result.body[i].attributes.rating.toUpperCase() + "\n**Score:** " + result.body[i].attributes.score + "\nhttp:" + result.body[i].attributes.file_url);
                        }
                        sendArray(msg.channel, info);
                    } else {
                        logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to fetch rule34 results");
                        bot.sendMessage(msg.channel, "I'm so sorry, rule34 has failed me  :'(");
                    }
                });
            } else {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "No parameters provided for rule34 command");
                bot.sendMessage(msg.channel, msg.author + " I need some tags to search for, yo!");
            }
        }
    },
    // Searches by tag on safebooru.org
    "safebooru": {
        usage: "<tags>",
        process: function(bot, msg, suffix) {
            if(suffix) {
                var query = suffix.substring(0, suffix.lastIndexOf(" "));
                var count = parseInt(suffix.substring(suffix.lastIndexOf(" ")+1));

                if(!query || isNaN(count)) {
                    query = suffix;
                }
                if(!count || count<1 || count>configs.servers[msg.channel.server.id].maxcount) {
                    count = configs.servers[msg.channel.server.id].defaultcount;
                }

                unirest.get("http://safebooru.donmai.us/posts.json?page=0&tags=" + encodeURI(query.replace(/&/g, '')) + "&limit=" + count)
                .headers({
                  "Accept": "application/json",
                  "User-Agent": "Unirest Node.js"
                })
                .end(function(result) {
                    if(result.status==200) {
                        var info = [];
                        for(var i=0; i<result.body.length; i++) {
                            info.push((result.body[i].description ? ("```" + result.body[i].description + "```") : "") + "**Author:** " + result.body[i].uploader_name + "\n**Rating:** " + result.body[i].rating.toUpperCase() + "\n**Score:** " + result.body[i].score + "\n**Favorites:** " + result.body[i].fav_count + "\nhttp://safebooru.donmai.us" + result.body[i].file_url);
                        }
                        sendArray(msg.channel, info);
                    } else {
                        logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to fetch safebooru results");
                        bot.sendMessage(msg.channel, "I'm so sorry, safebooru has failed me  :'(");
                    }
                });
            } else {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "No parameters provided for safebooru command");
                bot.sendMessage(msg.channel, msg.author + " I need some tags to search for, yo!");
            }
        }
    },
    // Create a temporary channel
    "room": {
        usage: "<\"text\" or \"voice\"> <username 1>|<username 2>|...",
        process: function(bot, msg, suffix) {
            if(["delete", "remove"].indexOf(suffix.toLowerCase())>-1 && rooms[msg.channel.id]) {
                bot.deleteChannel(msg.channel, function(err) {
                    if(err) {
                        logMsg(Date.now(), "ERROR", msg.channel.server.id, null, "Failed to delete room " + ch.name);
                        bot.sendMessage(msg.channel, "Dammit, I ran into trouble. Ask the mods to delete this room.");
                    } else {
                        delete rooms[msg.channel.id];
                        delete stats[msg.channel.server.id].botOn[msg.channel.id];
                        logMsg(Date.now(), "INFO", msg.channel.server.id, null, "Deleted room " + ch.name);
                    }
                });
                return;
            }
            if(suffix && ["text", "voice"].indexOf(suffix.split(" ")[0].toLowerCase())>-1) {
                var type = suffix.split(" ")[0].toLowerCase();
                suffix = suffix.substring(suffix.indexOf(" ")+1);
                var users = [bot.user, msg.author];
                if(suffix.toLowerCase().indexOf("game ")==0 && suffix.length>5) {
                    for(var i=0; i<msg.channel.server.members.length; i++) {
                        if(msg.channel.server.members[i].id!=bot.user.id && !msg.channel.server.members[i].bot && (getGame(msg.channel.server.members[i]) || "").toLowerCase()==suffix.substring(suffix.indexOf(" ")+1).toLowerCase().trim()) {
                            users.push(msg.channel.server.members[i]);
                        }
                    }
                } else {
                    if(suffix.split("|").length>0) {
                        for(var i=0; i<suffix.split("|").length; i++) {
                            var usr = userSearch(suffix.split("|")[i], msg.channel.server);
                            users.push(usr);
                        }
                    }
                }
                bot.createChannel(msg.channel.server, bot.user.username.toLowerCase().replaceAll(" ", "") + "-room-" + genToken(8), type, function(err, ch) {
                    if(err) {
                        logMsg(Date.now(), "ERROR", msg.channel.server.id, null, "Failed to create new room");
                        bot.sendMessage(msg.channel, "Dammit, I ran into trouble. Make sure the mods have given me channel and role permissions on this server.");
                    } else {
                        if(type=="text") {
                            var everyonePermissions = {
                                "readMessages": false,
                            };
                            var roomPermissions = {
                                "readMessages": true,
                                "sendMessages": true
                            }
                            rooms[ch.id] = setTimeout(function() {
                                bot.deleteChannel(ch, function(err) {
                                    if(err) {
                                        logMsg(Date.now(), "INFO", msg.channel.server.id, null, "Failed to auto-delete room " + ch.name);
                                    } else {
                                        delete rooms[ch.id];
                                        logMsg(Date.now(), "INFO", msg.channel.server.id, null, "Auto-deleted room " + ch.name);
                                    }
                                });
                            }, 300000);
                        } else {
                            var everyonePermissions = {
                                "voiceConnect": false
                            }
                            var roomPermissions = {
                                "voiceConnect": true,
                                "voiceSpeak": true
                            }
                            rooms[ch.id] = true;
                        }
                        bot.overwritePermissions(ch, msg.channel.server.roles.get("name", "@everyone"), everyonePermissions, function(err) {
                            if(err) {
                                bot.deleteChannel(ch, function(err) {
                                    logMsg(Date.now(), "ERROR", msg.channel.server.id, null, "Failed to create new room");
                                    bot.sendMessage(msg.channel, "Dammit, I ran into trouble. Make sure the mods have given me channel and role permissions on this server.");
                                });
                            } else {
                                var restrictChannel = function(i) {
                                    if(i<users.length) {
                                        bot.overwritePermissions(ch, users[i], roomPermissions, function(err) {
                                            restrictChannel(++i);
                                        });
                                    } else {
                                        logMsg(Date.now(), "INFO", msg.channel.server.id, null, "Created room " + ch.name);
                                        if(type=="text") {
                                            stats[ch.server.id].botOn[ch.id] = true;
                                            bot.sendMessage(ch, "First! *This room will be deleted after 5 minutes of inactivity.*");
                                        }
                                    }
                                };
                                restrictChannel(0);
                            }
                        });
                    }
                });
            } else {
                logMsg(Date.now(), "WARN", msg.channel.server.id, null, "Invalid parameters provided for room coomand");
                bot.sendMessage(msg.channel, msg.author + " Please at least specify `text` or `voice`");
            }
        }
    },
    // Defines word from Urban Dictionary
    "urban": {
        usage: "<term>",
        process: function(bot, msg, suffix) {
            var def = urban(suffix);
            def.first(function(data) {
                if(data) {
                    bot.sendMessage(msg.channel, "**" + suffix + "**: " + data.definition.replace("\r\n\r\n", "\n") + "\n*" + data.example.replace("\r\n\r\n", "\n") + "*\n`" + data.thumbs_up + " up, " + data.thumbs_down + " down`");
                } else {
                    logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Definition not found for " + suffix);
                    bot.sendMessage(msg.channel, "Wtf?! Urban Dictionary doesn't have an entry for " + suffix);
                }
            });
        }
    },
    // Queries Wolfram Alpha
    "wolfram" : {
        usage: "<Wolfram|Alpha query>",
        process(bot, msg, suffix) {
            if(!suffix) {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "User did not provide Wolfram|Alpha query");
                bot.sendMessage(msg.channel, msg.author + " I'm confused...");
                return;
            }
            wolfram.ask({query: suffix}, function(err, results) {
                if(err) {
                    logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Unable to connect to Wolfram|Alpha");
                    bot.sendMessage(msg.channel, "Unfortunately, I didn't get anything back from Wolfram|Alpha");
                } else {
                    var info = ""
                    try {
                        for(var i=0; i<results.pod.length; i++) {
                            var tmpinfo = "**" + results.pod[i].$.title + "**\n" + (results.pod[i].subpod[0].plaintext[0] || results.pod[i].subpod[0].img[0].$.src) + "\n";
                            if((tmpinfo.length + info.length)>2000) {
                                break;
                            } else {
                                info += tmpinfo;
                            }
                        }
                        bot.sendMessage(msg.channel, info);
                    } catch(notFound) {
                        logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Could not find Wolfram|Alpha data for " + suffix);
                        bot.sendMessage(msg.channel, "Wolfram|Alpha has nothing.");
                    }
                }
            });
        }
    },
    // Gets Wikipedia article with given title
    "wiki": {
        usage: "<search terms>",
        process: function(bot, msg, suffix) {
            if(!suffix) {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "User did not provide Wikipedia search term(s)");
                bot.sendMessage(msg.channel, msg.author + " You need to provide a search term.");
                return;
            }
            var wiki = new Wiki.default();
            wiki.search(suffix).then(function(data) {
                if(data.results.length==0) {
                    logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Wikipedia article not found for " + suffix);
                    bot.sendMessage(msg.channel, "I don't think Wikipedia has an article on that.");
                    return;
                }
                wiki.page(data.results[0]).then(function(page) {
                    page.summary().then(function(summary) {
                        if(summary.indexOf(" may refer to:") > -1 || summary.indexOf(" may stand for:") > -1) {
                            var options = summary.split("\n").slice(1);
                            var info = "Select one of the following:";
                            for(var i=0; i<options.length; i++) {
                                info += "\n\t" + i + ") " + options[i];
                            }
                            bot.sendMessage(msg.channel, info);
                            selectMenu(msg.channel, msg.author.id, function(i) {
                                commands.wiki.process(bot, msg, options[i].substring(0, options[i].indexOf(",")));
                            }, options.length-1);
                        } else {
                            var sumText = summary.split("\n");
                            var count = 0;
                            var continuation = function() {
                                var paragraph = sumText.shift();
                                if(paragraph && count<3) {
                                    count++;
                                    bot.sendMessage(msg.channel, paragraph, continuation);
                                }
                            };
                            bot.sendMessage(msg.channel, "**From " + page.raw.fullurl + "**", continuation);
                        }
                    });
                });
            }, function(err) {
                logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Unable to connect to Wikipedia");
                bot.sendMessage(msg.channel, "Uhhh...Something went wrong :(");
            });
        }
    },
    // Converts between units
    "convert": {
        usage: "<no.> <unit> to <unit>",
        process: function(bot, msg, suffix) {
            var toi = suffix.toLowerCase().lastIndexOf(" to ");
            if(toi==-1) {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "User used incorrect conversion syntax");
                bot.sendMessage(msg.channel, msg.author + " Sorry, I didn't get that. Make sure you're using the right syntax: `" + getPrefix(msg.channel.server) + "<no.> <unit> to <unit>`");
            } else {
                try {
                    var num = suffix.substring(0, suffix.indexOf(" "));
                    var unit = suffix.substring(suffix.indexOf(" ")+1, suffix.toLowerCase().lastIndexOf(" to ")).toLowerCase();
                    var end = suffix.substring(suffix.lastIndexOf(" ")+1).toLowerCase();

                    if(isNaN(num)) {
                        logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "User did not provide a numeric conversion quantity");
                        bot.sendMessage(msg.channel, msg.author + " That's not a number...");
                        return;
                    }
                    if(convert().possibilities().indexOf(unit)!=-1) {
                        if(convert().from(unit).possibilities().indexOf(end)!=-1) {
                            bot.sendMessage(msg.channel, (Math.round(convert(num).from(unit).to(end) * 1000) / 1000) + " " + end);
                            return;
                        }
                    }
                    if(unit=="c" && end=="f") {
                        bot.sendMessage(msg.channel, (Math.round((num * 9 / 5 + 32) * 1000) / 1000) + "°" + end.toUpperCase());
                        return;
                    }
                    if(unit=="f" && end=="c") {
                        bot.sendMessage(msg.channel, (Math.round(((num - 32) * 5 / 9) * 1000) / 1000) + "°" + end.toUpperCase());
                        return;
                    }
                    try {
                        bot.sendMessage(msg.channel, (Math.round(fx.convert(num, {from: unit.toUpperCase(), to: end.toUpperCase()}) * 100) / 100) + " " + end.toUpperCase());
                    } catch(error) {
                        logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Unsupported conversion unit(s)");
                        bot.sendMessage(msg.channel, msg.author + " I don't support that unit, try something else.");
                    }
                } catch(err) {
                    logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "User used incorrect convert syntax");
                    bot.sendMessage(msg.channel, msg.author + " Are you sure you're using the correct syntax?");
                }
            }
        }
    },
    // Fetches stock symbol from Yahoo Finance
    "stock": {
        usage: "<stock symbol>",
        process: function(bot, msg, suffix) {
            if(!suffix) {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "User did not provide stock symbol");
                bot.sendMessage(msg.channel, msg.author + " You never gave me a stock symbol! I'm not a magician, you know.");
                return;
            }
            unirest.get("http://finance.yahoo.com/webservice/v1/symbols/" + suffix + "/quote?format=json&view=detail")
            .header("Accept", "application/json")
            .end(function(result) {
                if(result.status==200 && JSON.parse(result.raw_body).list.resources[0]) {
                    var data = JSON.parse(result.raw_body).list.resources[0].resource.fields;
                    var info = data.issuer_name + " (" + data.symbol + ")\n\t$" + (Math.round((data.price)*100)/100) + "\n\t";
                    info += " " + (Math.round((data.change)*100)/100) + " (" + (Math.round((data.chg_percent)*100)/100) + "%)\n\t$" + (Math.round((data.day_low)*100)/100) + "-$" + (Math.round((data.day_high)*100)/100);
                    bot.sendMessage(msg.channel, info);
                } else {
                    logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Stock symbol " + suffix + " not found")
                    bot.sendMessage(msg.channel, "Sorry, I can't find that stock symbol.");
                }
            });
        }
    },
    // Displays the weather for an area
    "weather": {
        usage: "<location> [<\"F\" or \"C\">]",
        process: function(bot, msg, suffix) {
            if(profileData[msg.author.id] && !suffix) {
                for(var key in profileData[msg.author.id]) {
                    if(key.toLowerCase()=="location") {
                        suffix = profileData[msg.author.id][key];
                        break;
                    }
                }
            }

            var unit = "F";
            var location = suffix;
            if([" F", " C"].indexOf(suffix.toUpperCase().substring(suffix.length-2))>-1) {
                unit = suffix.charAt(suffix.length-1).toUpperCase().toString();
                location = suffix.substring(0, suffix.length-2);
            }
            if(location.indexOf("in ")==0) {
                location = location.slice(3);
            }

            if(!location) {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Weather location not provided");
                bot.sendMessage(msg.channel, msg.author + " I don't have a default location set for you. PM me `profile location|<your city>` to set one.");
                return;
            }

            try {
                weather.find({search: location, degreeType: unit}, function(err, data) {
                    if(err) {
                        logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Could not find weather for location " + location);
                        bot.sendMessage(msg.channel, msg.author + " I can't find weather info for " + location);
                    } else {
                        data = data[0];
                        bot.sendMessage(msg.channel, "**" + data.location.name + " right now:**\n" + data.current.temperature + "°" + unit + " " + data.current.skytext + ", feels like " + data.current.feelslike + "°, " + data.current.winddisplay + " wind\n**Forecast for tomorrow:**\nHigh: " + data.forecast[1].high + "°, low: " + data.forecast[1].low + "° " + data.forecast[1].skytextday + " with " + data.forecast[1].precip + "% chance precip.");
                    }
                });
            } catch(err) {
                logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Weather.JS threw an error");
                bot.sendMessage(msg.channel, "Idk why this is broken tbh :(");
            }
        }
    },
    // Silences the bot until the start statement is issued
    "quiet": {
        usage: "[<\"all\" or time>]",
        process: function(bot, msg, suffix) {
            var timestr = "";
            if(suffix.toLowerCase()=="all") {
                timestr = " in all channels";
                for(var chid in stats[msg.channel.server.id].botOn) {
                    stats[msg.channel.server.id].botOn[chid] = false;
                }
            } else if(parseTime(suffix)) {
                var time = parseTime(suffix);
                if(time.countdown>3600000) {
                    logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Invalid quiet time provided by " + msg.author.username);
                    bot.sendMessage(msg.channel, msg.author + " Too big.");
                    return;
                }
                timestr = " for " + time.num + " " + time.time;
                stats[msg.channel.server.id].botOn[msg.channel.id] = false;
                setTimeout(function() {
                    stats[msg.channel.server.id].botOn[msg.channel.id] = true;
                }, time.countdown);
            } else {
                stats[msg.channel.server.id].botOn[msg.channel.id] = false;
            }
            logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Bot has been quieted by an admin" + timestr);
            bot.sendMessage(msg.channel, "Ok, I'll shut up" + timestr);
        }
    },
    // Shows strikes for a user
    "strikes": {
        usage: "<username>",
        process: function(bot, msg, suffix) {
            if(suffix) {
                var info = [""];
                var index = 0;
                var usr = userSearch(suffix, msg.channel.server);
                if(usr) {
                    checkStats(usr.id, msg.channel.server.id);
                    for(var i=0; i<stats[msg.channel.server.id].members[usr.id].strikes.length; i++) {
                        var tmpinfo = prettyDate(new Date(stats[msg.channel.server.id].members[usr.id].strikes[i][2])) + " from ";
                        if(stats[msg.channel.server.id].members[usr.id].strikes[i][0]=="Automatic") {
                            tmpinfo += "Automatic";
                        } else {
                            var adder = msg.channel.server.members.get("id", stats[msg.channel.server.id].members[usr.id].strikes[i][0]);
                            if(adder) {
                                tmpinfo += "**@" + getName(msg.channel.server, adder) + "**";
                            } else {
                                tmpinfo += "@" + stats[msg.channel.server.id].members[usr.id].strikes[i][0];
                            }
                        }
                        tmpinfo += ": " + stats[msg.channel.server.id].members[usr.id].strikes[i][1] + "\n";
                        if((tmpinfo.length + info[index].length)>2000) {
                            index++;
                            info[index] = "";
                        } 
                        info[index] += tmpinfo;
                    }
                    if(!info[0]) {
                        info = ["**@" + getName(msg.channel.server, usr) + "** has a clean record! :smile: :100: :ok_hand:"];
                    }
                    sendArray(msg.channel, info);
                } else {
                    logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Invalid user provided for strikes command");
                    bot.sendMessage(msg.channel, msg.author + " Who's that? Please introduce me to " + suffix);
                }
            } else {
                var strikes = [];
                for(var usrid in stats[msg.channel.server.id].members) {
                    var usr = msg.channel.server.members.get("id", usrid);
                    if(usr && stats[msg.channel.server.id].members[usrid].strikes.length>0) {
                        strikes.push([getName(msg.channel.server, usr), stats[msg.channel.server.id].members[usrid].strikes.length]);
                    }
                }
                strikes.sort(function(a, b) {
                    return b[1] - a[1];
                });
                var info = "";
                for(var i=0; i<strikes.length; i++) {
                    info += "**@" + strikes[i][0] + "**: " + strikes[i][1] + " strike" + (strikes[i][1]==1 ? "" : "s") + "\n";
                }
                bot.sendMessage(msg.channel, info);
            }
        }
    },
    // Creates a command cooldown until the end statement is issued
    "cool": {
        usage: "<cooldown time or \"end\">[|<cooldown duration>]",
        process: function(bot, msg, suffix) {
            var timestr = "";
            if(suffix.toLowerCase()=="end") {
                delete stats[msg.channel.server.id].cools[msg.channel.id];
                logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Cooldown removed by admin");
                bot.sendMessage(msg.channel, "Vroom vroom :fast_forward:");
                return;
            } else if(parseTime(suffix)) {
                var time = parseTime(suffix);
                if(time.countdown>300000) {
                    logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Invalid cooldown time provided by " + msg.author.username);
                    bot.sendMessage(msg.channel, msg.author + " Too big.");
                    return;
                }
                timestr = " of " + time.num + " " +  time.time;
                stats[msg.channel.server.id].cools[msg.channel.id] = time.countdown;
            } else if(suffix.split("|").length==2 && parseTime(suffix.split("|")[0]) && parseTime(suffix.split("|")[1])) {
                var time1 = parseTime(suffix.split("|")[0]);
                var time2 = parseTime(suffix.split("|")[1]);
                if(time1[2]>300000 || time2[2]>3600000) {
                    logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Invalid cooldown time(s) provided by " + msg.author.username);
                    bot.sendMessage(msg.channel, msg.author + " Too big.");
                    return;
                }
                timestr = " of " + time1.num + " " + time1.time + " for " + time2.num + " " + time2.time;
                stats[msg.channel.server.id].cools[msg.channel.id] = time1.countdown;
                setTimeout(function() {
                    delete stats[msg.channel.server.id].cools[msg.channel.id];
                }, time2.countdown);
            } else {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Invalid cooldown parameters provided by " + msg.author.username);
                bot.sendMessage(msg.channel, msg.author + " You seem confused :thinking:");
                return;
            }
            logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Cooldown" + timestr + " created by admin");
            bot.sendMessage(msg.channel, "Created command cooldown" + timestr);
        }
    },
    // Starts, ends, and answers live trivia game
    "trivia": {
        usage: "<start, end, next, or answer choice> [<question set to use>]",
        process: function(bot, msg, suffix) {
            var triviaOn = stats[msg.channel.server.id].trivia[msg.channel.id]!=null;

            if(suffix.indexOf("start")==0 && suffix.indexOf(" ")>-1 && suffix.indexOf(" ")<suffix.length-1) {
                var tset = suffix.substring(suffix.indexOf(" ")+1);
                suffix = "start";
            }
            switch(suffix) {
                case "start":
                    if(!triviaOn) {
                        stats[msg.channel.server.id].trivia[msg.channel.id] = {
                            answer: "",
                            attempts: 0,
                            score: 0,
                            possible: 0,
                            done: [],
                            responders: {}
                        };
                        if(tset) {
                            if(!configs.servers[msg.channel.server.id].triviasets[tset]) {
                                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Provided trivia set does not exist");
                                bot.sendMessage(msg.channel, msg.author + " The higher-ups haven't added that trivia set to my database. The list of available custom sets is available via my help command.");
                                delete stats[msg.channel.server.id].trivia[msg.channel.id];
                                return;
                            }
                            stats[msg.channel.server.id].trivia[msg.channel.id].set = tset;
                        }
                        logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Trivia game started");
                        bot.sendMessage(msg.channel, "Welcome to **AwesomeTrivia**! Here's your first question: " + triviaQ(msg.channel, stats[msg.channel.server.id].trivia[msg.channel.id].set) + "\nAnswer by tagging me like this: `" + getPrefix(msg.channel.server) + "trivia <answer>` or skip by doing this: `" + getPrefix(msg.channel.server) + "trivia next`\nGood Luck!");
                        stats[msg.channel.server.id].trivia[msg.channel.id].possible++;
                        if(!stats[msg.channel.server.id].commands.trivia) {
                            stats[msg.channel.server.id].commands.trivia = 0;
                        }
                        stats[msg.channel.server.id].commands.trivia++;
                    } else {
                        logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Ongoing trivia game; new one cannot be started");
                        bot.sendMessage(msg.channel, "There's a trivia game already in progress on this server, in " + msg.channel.name);
                    }
                    break;
                case "end":
                    if(triviaOn) {
                        logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Trivia game ended, score: " + stats[msg.channel.server.id].trivia[msg.channel.id].score + " out of " + (stats[msg.channel.server.id].trivia[msg.channel.id].possible-1));
                        bot.sendMessage(msg.channel, endTrivia(stats[msg.channel.server.id].trivia[msg.channel.id], msg.channel.server, true));
                        delete stats[msg.channel.server.id].trivia[msg.channel.id];
                    } else {
                        logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "No ongoing trivia game to end");
                        bot.sendMessage(msg.channel, "There isn't a trivia game going on right now. Start one by typing `" + getPrefix(msg.channel.server) + "trivia start [<question set to use>]`");
                    }
                    break;
                case "skip":
                case "next":
                    if(triviaOn) {
                        logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Trivia question skipped by " + msg.author.username);
                        var info = "The answer was " + stats[msg.channel.server.id].trivia[msg.channel.id].answer;
                        var q = triviaQ(msg.channel, stats[msg.channel.server.id].trivia[msg.channel.id].set);
                        if(q) {
                            info += "\n**Next Question:** " + q;
                            stats[msg.channel.server.id].trivia[msg.channel.id].possible++;
                        } else {
                            logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Trivia game ended, score: " + stats[msg.channel.server.id].trivia[msg.channel.id].score + " out of " + stats[msg.channel.server.id].trivia[msg.channel.id].possible);
                            info += "\nNo more questions. " + endTrivia(stats[msg.channel.server.id].trivia[msg.channel.id], msg.channel.server);
                            delete stats[msg.channel.server.id].trivia[msg.channel.id];
                        }
                        bot.sendMessage(msg.channel, info);
                    } else {
                        logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "No ongoing trivia game in which to skip question");
                        bot.sendMessage(msg.channel, "There isn't a trivia game going on right now. Start one by typing `" + getPrefix(msg.channel.server) + "trivia start`");
                    }
                    break;
                default:
                    if(triviaOn) {
                        var compare = function(answer) {
                            if(answer.toLowerCase().trim().length<5 || !isNaN(answer.toLowerCase().trim())) {
                                return suffix.toLowerCase()==answer.toLowerCase().trim();
                            }
                            return levenshtein.get(suffix.toLowerCase(), answer.toLowerCase().trim())<3;
                        }
                        var checkAnswer = function() {
                            var answers = stats[msg.channel.server.id].trivia[msg.channel.id].answer.split("|");
                            for(var i=0; i<answers.length; i++) {
                                if(answers[i] && compare(answers[i])) {
                                    return true;
                                }
                            }
                            return false;
                        }
                        if(checkAnswer() && triviaOn) {
                            logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Correct trivia game answer by " + msg.author.username);

                            // Award AwesomePoints to author
                            if(!profileData[msg.author.id]) {
                                profileData[msg.author.id] = {
                                    points: 0
                                };
                            }
                            profileData[msg.author.id].points += 5;

                            // Move on to next question
                            if(stats[msg.channel.server.id].trivia[msg.channel.id].attempts<=2) {
                                stats[msg.channel.server.id].trivia[msg.channel.id].score++;
                                if(!stats[msg.channel.server.id].trivia[msg.channel.id].responders[msg.author.id]) {
                                    stats[msg.channel.server.id].trivia[msg.channel.id].responders[msg.author.id] = 0;
                                }
                                stats[msg.channel.server.id].trivia[msg.channel.id].responders[msg.author.id]++;
                            }
                            stats[msg.channel.server.id].trivia[msg.channel.id].attempts = 0;

                            var info = msg.author + " got it right! The answer is " + stats[msg.channel.server.id].trivia[msg.channel.id].answer;

                            var q = triviaQ(msg.channel, stats[msg.channel.server.id].trivia[msg.channel.id].set);
                            if(q) {
                                info += "\n**Next Question:** " + q;
                                stats[msg.channel.server.id].trivia[msg.channel.id].possible++;
                            } else {
                                logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Trivia game ended, score: " + stats[msg.channel.server.id].trivia[msg.channel.id].score + " out of " + stats[msg.channel.server.id].trivia[msg.channel.id].possible);
                                info += "\nNo more questions. " + endTrivia(stats[msg.channel.server.id].trivia[msg.channel.id], msg.channel.server);
                                delete stats[msg.channel.server.id].trivia[msg.channel.id];
                            }
                            bot.sendMessage(msg.channel, info);
                        } else if(triviaOn) {
                            bot.sendMessage(msg.channel, msg.author + " Nope :(");
                            stats[msg.channel.server.id].trivia[msg.channel.id].attempts++;
                        }
                    } else {
                        logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "No ongoing trivia game to answer");
                        bot.sendMessage(msg.channel, "There isn't a trivia game going on right now. Start one by typing `" + getPrefix(msg.channel.server) + "trivia start`");
                    }
            }
        }
    },
    // Sends reminders in given time for given note
    "remindme": {
        usage: "<time from now> <note>",
        process: function(bot, msg, suffix) {
            parseReminder(suffix, msg.author, msg.channel);
        }
    },
    // Gets top (max 5) posts in given subreddit, sorting hot
    "reddit": {
        usage: "<subreddit> [<count>]",
        process: function(bot, msg, suffix) {
            var path = "/.json"
            var count = configs.servers[msg.channel.server.id].defaultcount;
            if(suffix) {
                if(suffix.indexOf(" ")>-1) {
                    var sub = suffix.substring(0, suffix.indexOf(" "));
                    count = suffix.substring(suffix.indexOf(" ")+1);
                    if(count.indexOf(" ")>-1) {
                        count = count.substring(0, count.indexOf(" "));
                    }
                    path = "/r/" + sub + path;
                } else {
                    path = "/r/" + suffix + path;
                }
            } else {
                sub = "all";
                count = configs.servers[msg.channel.server.id].defaultcount;
            }
            if(!sub || !count || isNaN(count)) {
                sub = suffix;
                count = configs.servers[msg.channel.server.id].defaultcount;
            }
            if(count<1 || count>configs.servers[msg.channel.server.id].maxcount) {
                count = configs.servers[msg.channel.server.id].defaultcount;
            }
            unirest.get("https://www.reddit.com" + path)
            .header("Accept", "application/json")
            .end(function(result) {
                if(result.body.data) {
                    var data = result.body.data.children;
                    var info = "";
                    var c = count;
                    for(var i=0; i<c; i++) {
                        if(!data[i] || !data[i].data || !data[i].data.score) {
                            logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Subreddit not found or Reddit unavailable");
                            bot.sendMessage(msg.channel, "Surprisingly, I couldn't find anything in " + sub + " on reddit.");
                            return;
                        } else if(data[i].data.over_18 && configs.servers[msg.channel.server.id].admins.indexOf(msg.author.id)==-1 && configs.servers[msg.channel.server.id].nsfwfilter[0] && configs.servers[msg.channel.server.id].nsfwfilter[1].indexOf(msg.channel.id)==-1 && configs.servers[msg.channel.server.id].servermod) {
                            handleFiltered(msg, "NSFW");
                            return;
                        } else if(!data[i].data.stickied) {
                            info += "`" + data[i].data.score + "` " + data[i].data.title + " **" + data[i].data.author + "** *" + data[i].data.num_comments + " comments*";
                            info += ", https://redd.it/" + data[i].data.id + "\n";
                        } else {
                            c++;
                        }
                    }
                    bot.sendMessage(msg.channel, info);
                } else {
                    logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Subreddit not found or Reddit unavailable");
                    bot.sendMessage(msg.channel, "Surprisingly, I couldn't find anything in " + sub + " on reddit.");
                }
            });
        }
    },
    // Gets top (max 5) posts in given RSS feed name
    "rss": {
        usage: "<site> [<count>]",
        process: function(bot, msg, suffix) {
            if(configs.servers[msg.channel.server.id].rss[0]) {
                var site = suffix.substring(0, suffix.indexOf(" "));
                var count = parseInt(suffix.substring(suffix.indexOf(" ")+1));

                if(site=="" || !site || isNaN(count)) {
                    site = suffix;
                    count = configs.servers[msg.channel.server.id].defaultcount;
                }
                getRSS(msg.channel.server.id, site, (count<1 || count>configs.servers[msg.channel.server.id].maxcount) ? configs.servers[msg.channel.server.id].defaultcount : count, function(err, articles) {
                    if(err) {
                        logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Feed " + site + " not found");
                        bot.sendMessage(msg.channel, msg.author + " Feed not found.");
                    } else {
                        var info = "";
                        for(var i=0; i<articles.length; i++) {
                            var tmpinfo = (articles[i].published instanceof Date ? ("`" + prettyDate(articles[i].published) + "`") : "") + " **"  + articles[i].title + "**\n" + articles[i].link + "\n";
                            if((tmpinfo.length + info.length)>2000) {
                                break;
                            } else {
                                info += tmpinfo;
                            }
                        }
                        bot.sendMessage(msg.channel, info);
                    }
                });
            }
        }
    },
    // Generates a random number
    "roll": {
        usage: "[<min inclusive>] [<max inclusive>]",
        process: function(bot, msg, suffix) {
            if(suffix.indexOf(" ")>-1) {
                var min = suffix.substring(0, suffix.indexOf(" "));
                var max = suffix.substring(suffix.indexOf(" ")+1);
            } else if(!suffix) {
                var min = 1;
                var max = 6;
            } else {
                var min = 0;
                var max = suffix;
            }
            var roll = getRandomInt(parseInt(min), parseInt(max));
            if(isNaN(roll)) {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, msg.author.username + " provided nonsensical roll parameter");
                bot.sendMessage(msg.channel, msg.author + " Wut.");
            } else {
                bot.sendMessage(msg.channel, msg.author + " rolled a " + parseInt(roll));
            }
        }
    },
    // Uses goo.gl to shorten a URL
    "shorten": {
        usage: "<URL to shorten or decode>",
        process: function(bot, msg, suffix) {
            if(suffix) {
                if(suffix.toLowerCase().indexOf("http://goo.gl/")==0 || suffix.toLowerCase().indexOf("goo.gl/")==0) {
                    googl.expand(suffix).then(function(url) {
                        bot.sendMessage(msg.channel, url);
                    }).catch(function(err) {
                        logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to expand goo.gl URL");
                        bot.sendMessage(msg.channel, "An error occurred. *That's all we know.*");
                    });
                } else {
                    googl.shorten(suffix).then(function(url) {
                        bot.sendMessage(msg.channel, url);
                    }).catch(function(err) {
                        logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to shorten URL");
                        bot.sendMessage(msg.channel, "An error occurred. *That's all we know.*");
                    });
                }
            } else {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, msg.author.username + " did not provide URL for shorten command");
                bot.sendMessage(msg.channel, msg.author + " You humans are confusing. How am I supposed to know the URL?!");
            }
        }
    },
    // Enrolls in a giveaway
    "giveaway": {
        usage: "<name of giveaway>",
        process: function(bot, msg, suffix) {
            var g = getGiveaway(suffix);
            if(g) {
                if(g==msg.author.id) {
                    logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, msg.author.username + " tried to enroll in own giveaway " + giveaways[g].name);
                    bot.sendMessage(msg.channel, "Hey, you're the one who created that giveaway!");
                    return;
                }
                if(giveaways[g].enrolled.indexOf(msg.author.id)>-1) {
                    giveaways[g].enrolled.splice(giveaways[g].enrolled.indexOf(msg.author.id), 1);
                    logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Disenrolled " + msg.author.username + " in giveaway " + giveaways[g].name);
                    bot.sendMessage(msg.channel, msg.author + " I disenrolled you");
                } else {
                    giveaways[g].enrolled.push(msg.author.id);
                    logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Enrolled " + msg.author.username + " in giveaway " + giveaways[g].name);
                    bot.sendMessage(msg.channel, "Ok " + msg.author + " you've been entered to win!");
                }
                saveData("./data/giveaways.json", function(err) {
                    if(err) {
                        logMsg(Date.now(), "ERROR", "General", null, "Failed to save updated giveaways data");
                    }
                });
            } else if(msg.content.indexOf(suffix)>-1) {
                var info = "Select one of the following:";
                var results = [];
                var count = 0;
                for(var usrid in giveaways) {
                    if(giveaways[usrid].channel==msg.channel.id) {
                        info += "\n\t" + count + ") " + giveaways[usrid].name;
                        results.push(giveaways[usrid].name);
                        count++;
                    }
                }
                if(count>0) {
                    bot.sendMessage(msg.channel, info);
                    selectMenu(msg.channel, msg.author.id, function(i) {
                        commands.giveaway.process(bot, msg, results[i]);
                    }, count-1);
                }
            }
        }
    },
    // Uploads an image to imgur
    "imgur": {
        usage: "<*attach an image* or image URL>",
        process: function(bot, msg, suffix) {
            if(msg.attachments.length==0 && !suffix) {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "User did not provide image to upload to Imgur");
                bot.sendMessage(msg.channel, msg.author + " Please attach an image or include an image URL :hushed:");
                return;
            }
            var imageurl = "http://i.imgur.com/KmkCXHt.jpg";
            if(suffix && (/(http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/).test(suffix)) {
                imageurl = suffix;
            }
            if(msg.attachments.length>0) {
                imageurl = msg.attachments[0].url;
            }
            try {
                imgur.upload(imageurl, function(err, res) {
                    if(err) {
                        logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to upload to Imgur");
                        bot.sendMessage(msg.channel, "Imgur is probably down, ***again***. *Sigh*.");
                    } else {
                        bot.sendMessage(msg.channel, res.data.link);
                    }
                });
            } catch(err) {
                logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to upload to Imgur");
                bot.sendMessage(msg.channel, "Imgur is probably down, ***again***. *Sigh*.");
            }
        }
    },
    // Votes on an active poll in public
    "vote": {
        usage: "[<no. of choice>]",
        process: function(bot, msg, suffix) {
            var act = activePolls(msg.channel.id);
            if(!polls[act] || !polls[act].open) {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Cannot vote when there is no active poll");
                bot.sendMessage(msg.channel, "There isn't an active poll in this channel. PM me `poll " + msg.channel.server.name + " " + msg.channel.name + "` to start one!");
            } else {
                if(!suffix) {
                    var ch = bot.channels.get("id", polls[act].channel);
                    var info = pollResults(act, "Ongoing results", "current leader");
                    info += "\nRemember, vote by typing `" + getPrefix(msg.channel.server) + "vote <no. of choice>`";
                    bot.sendMessage(ch, info);
                } else {
                    var vt = suffix;
                    if(isNaN(vt)) {
                        vt = polls[act].options.join().toLowerCase().split(",").indexOf(vt.toLowerCase());
                    }
                    if(polls[act].responderIDs.indexOf(msg.author.id)==-1 && vt<polls[act].options.length && vt>=0) {
                        polls[act].responses.push(vt);
                        polls[act].responderIDs.push(msg.author.id);
                        logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Vote cast for " + vt + " by " + msg.author.username);
                        bot.sendMessage(msg.channel, "Cast vote for `" + polls[act].options[vt] + "`");
                        saveData("./data/polls.json", function(err) {
                            if(err) {
                                logMsg(Date.now(), "ERROR", "General", null, "Failed to save updated polls data");
                            }
                        });
                    } else {
                        logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Could not cast " + msg.author.username + "'s vote, duplicate or not an option");
                        bot.sendMessage(msg.channel, msg.author + " I couldn't cast your vote.");
                    }
                }
            }
        }
    },
    // Show list of games being played
    "games": {
        process: function(bot, msg) {
            if(configs.servers[msg.channel.server.id].stats) {
                var rawGames = {};
                for(var i=0; i<msg.channel.server.members.length; i++) {
                    if(msg.channel.server.members[i].id!=bot.user.id && !msg.channel.server.members[i].bot && getGame(msg.channel.server.members[i]) && msg.channel.server.members[i].status!="offline") {
                        if(!rawGames[getGame(msg.channel.server.members[i])]) {
                            rawGames[getGame(msg.channel.server.members[i])] = [];
                        }
                        rawGames[getGame(msg.channel.server.members[i])].push(getName(msg.channel.server, msg.channel.server.members[i]));
                    }
                }
                var games = [];
                for(var game in rawGames) {
                    var playingFor;
                    if(stats[msg.channel.server.id].games[game]) {
                        playingFor = secondsToString(stats[msg.channel.server.id].games[game] * 3000) + "this week";
                    }
                    games.push([game, rawGames[game], playingFor]);
                }
                games.sort(function(a, b) {
                    return a[1].length - b[1].length;
                });
                var info = "";
                for(var i=games.length-1; i>=0; i--) {
                    var tmpinfo = "**" + games[i][0] + "** (" + games[i][1].length + ")";
                    if(games[i][2]) {
                        tmpinfo+="\n*" + games[i][2] + "*";
                    }
                    for(var j=0; j<games[i][1].length; j++) {
                        tmpinfo += "\n\t@" + games[i][1][j];
                    }
                    tmpinfo += "\n";
                    if((tmpinfo.length + info.length)>2000) {
                        break;
                    } else {
                        info += tmpinfo;
                    }
                }
                bot.sendMessage(msg.channel, info);
            }
        }
    },
    // Set roles or colors
    "role": {
        usage: "<role name or hex code>[|<username or hex code>]",
        process: function(bot, msg, suffix) {
            if(suffix.indexOf("color")==0 || suffix.indexOf("colour")==0) {
                if(configs.servers[msg.channel.server.id].customcolors || configs.servers[msg.channel.server.id].admins.indexOf(msg.author.id)>-1) {
                    var colornm = suffix.indexOf("#")==0 ? suffix.slice(1) : suffix;
                    var rolenm = "color-" + msg.author.id.toString();
                    var roles = msg.channel.server.roles;
                    if(colornm && colornm.length==6) {
                        if(roles.get("name", rolenm)) {
                            bot.updateRole(roles.get("name", rolenm), {color: parseInt("0x" + colornm, 16)}, function(err, role) {
                                if(!err) {
                                    bot.addMemberToRole(msg.author, role, function(error) {
                                        logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Re-colored " + msg.author.username + " to #" + colornm);
                                        bot.sendMessage(msg.channel, msg.author + " Ok, you now have the color `#" + colornm + "`");
                                    });
                                } else {
                                    logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to re-color " + msg.author.username + " to #" + colornm);
                                    bot.sendMessage(msg.channel, msg.author + " Hmmm, I couldn't change your role color. Perhaps I don't have role management permissions on this server.");
                                }
                            });
                        } else {
                            bot.createRole(msg.channel.server, {color: parseInt("0x" + colornm, 16), hoist: false, name: rolenm}, function(err, role) {
                                if(!err) {
                                    bot.addMemberToRole(msg.author, role, function(error) {
                                        logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Colored " + msg.author.username + " to #" + colornm);
                                        bot.sendMessage(msg.channel, msg.author + " Ok, you now have the color `#" + colornm + "`");
                                    });
                                } else {
                                    logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to color " + msg.author.username + " to #" + colornm);
                                    bot.sendMessage(msg.channel, msg.author + " Hmmm, I couldn't set your role color. Perhaps I don't have role management permissions on this server.");
                                }
                            });
                        }
                    } else if(suffix.substring(suffix.indexOf(" ")+1)==".") {
                        bot.deleteRole(roles.get("name", rolenm), function(err) {
                            if(err) {
                                logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to remove color for " + msg.author.username);
                                bot.sendMessage(msg.channel, msg.author + " I couldn't remove your role color. Perhaps I don't have role management permissions on this server.");
                            } else {
                                logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Removed color for " + msg.author.username);
                                bot.sendMessage(msg.channel, msg.author + " You don't have a color anymore! :P");
                            }
                        });
                    } else {
                        logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, msg.author.username + " did not provide color code for profile command");
                        bot.sendMessage(msg.channel, msg.author + " Please provide a hex code, preceded by a pound sign. Something like `" + getPrefix(msg.channel.server) + "profile color #FFFFFF`");
                    }
                } else {
                    bot.sendMessage(msg.channel, "Setting custom colors is disabled in this server, sorry.");
                }
            } else if(configs.servers[msg.channel.server.id].admins.indexOf(msg.author.id)>-1 && suffix.indexOf("|")>0 && suffix.length>=2) {
                var rolenm = suffix.substring(0, suffix.indexOf("|"));
                var role = msg.channel.server.roles.get("name", rolenm);
                if(rolenm && role) {
                    suffix = suffix.substring(suffix.indexOf("|")+1);
                    if((suffix.indexOf("#")==0 && suffix.length==7) || suffix.length==6) {
                        var colornm = suffix.indexOf("#")==0 ? suffix.slice(1) : suffix;
                        bot.updateRole(role, {color: parseInt("0x" + colornm, 16)}, function(err, role) {
                            if(err) {
                                logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to change color of role " + role.name);
                                bot.sendMessage(msg.channel, "Rats! Discord isn't letting me change the color of `" + role.name + "`");
                            } else {
                                bot.sendMessage(msg.channel, "Alrighty!")
                            }
                        });
                    } else {
                        var usr = userSearch(suffix, msg.channel.server);
                        if(usr) {
                            if(bot.memberHasRole(usr, role)) {
                                bot.removeMemberFromRole(usr, role, function(err) {
                                    if(err) {
                                        logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to remove " + msg.author.username + " from role " + role.name);
                                        bot.sendMessage(msg.channel, "I couldn't remove **@" + getName(msg.channel.server, usr) + "** from `" + role.name + "`. Maybe I don't have role management permissions on this server.");
                                    } else {
                                        bot.sendMessage(msg.channel, "Done! **@" + getName(msg.channel.server, usr) + "** no longer has the role `" + role.name + "`");
                                    }
                                });
                            } else {
                                bot.addMemberToRole(usr, role, function(err) {
                                    if(err) {
                                        logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to add " + msg.author.username + " to role " + role.name);
                                        bot.sendMessage(msg.channel, "I couldn't add **@" + getName(msg.channel.server, usr) + "** to `" + role.name + "`. Maybe I don't have role management permissions on this server.");
                                    } else {
                                        bot.sendMessage(msg.channel, "Done! **@" + getName(msg.channel.server, usr) + "** now has the role `" + role.name + "`");
                                    }
                                });
                            }
                        } else {
                            logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Invalid user provided by admin to edit role");
                            bot.sendMessage(msg.channel, msg.author + " Who's that? Would you mind introducing them to me?");
                        }
                    }
                } else {
                    logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Invalid role provided by admin");
                    bot.sendMessage(msg.channel, msg.author + " Wot.");
                }
            } else if(configs.servers[msg.channel.server.id].customroles[0]) {
                var rolenm = suffix;
                if(rolenm) {
                    var roles = msg.channel.server.roles;
                    if(roles.get("name", rolenm)) {
                        if(bot.memberHasRole(msg.author, roles.get("name", rolenm)) && configs.servers[msg.channel.server.id].customroles[1].indexOf(roles.get("name", rolenm).id)>-1) {
                            bot.removeMemberFromRole(msg.author.id, roles.get("name", rolenm), function(err) {
                                if(err) {
                                    logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to remove " + msg.author.username + " from role " + roles.get("name", rolenm).name);
                                    bot.sendMessage(msg.channel, msg.author + " I couldn't remove you from that role. Maybe I don't have role management permissions on this server.");
                                } else {
                                    logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Removed " + msg.author.username + " from role " + roles.get("name", rolenm).name);
                                    bot.sendMessage(msg.channel, msg.author + " Ok, you no longer have the role `" + roles.get("name", rolenm).name + "`");
                                }
                            });
                        } else if(configs.servers[msg.channel.server.id].customroles[1].indexOf(roles.get("name", rolenm).id)>-1) {
                            bot.addMemberToRole(msg.author, roles.get("name", rolenm).id, function(error) {
                                if(error) {
                                    logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to add " + msg.author.username + " to role " + roles.get("name", rolenm).name);
                                    bot.sendMessage(msg.channel, msg.author + " I couldn't add you to that role. Maybe I don't have role management permissions on this server.");
                                } else {
                                    logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Added " + msg.author.username + " to role " + roles.get("name", rolenm).name);
                                    bot.sendMessage(msg.channel, msg.author + " Ok, you now have the role `" + roles.get("name", rolenm).name + "`");
                                }
                            });
                        } else {
                            logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Cannot add " + msg.author.username + " to existing role " + roles.get("name", rolenm).name);
                            bot.sendMessage(msg.channel, msg.author + " I couldn't add you to that role since it already exists.");
                        }
                    } else if(configs.servers[msg.channel.server.id].customroles[2]) {
                        bot.createRole(msg.channel.server, {name: rolenm, hoist: true}, function(err, role) {
                            if(err) {
                                logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to create role " + rolenm + " for " + msg.author.username);
                                bot.sendMessage(msg.channel, msg.author + " I couldn't create that role. Maybe I don't have role management permissions on this server.");
                            } else {
                                bot.addMemberToRole(msg.author, role, function(error) {
                                    if(error) {
                                        logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to add " + msg.author.username + " to role " + role.name);
                                        bot.sendMessage(msg.channel, msg.author + " I couldn't add you to that role. Maybe I don't have role management permissions on this server.");
                                    } else {
                                        logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Created and added " + msg.author.username + " to role " + role.name);
                                        bot.sendMessage(msg.channel, msg.author + " Ok, you now have the role `" + role.name + "`");
                                    }
                                });
                            }
                        });
                    } else {
                        bot.sendMessage(msg.channel, "Setting custom roles is disabled in this server, sorry.");
                    }
                } else {
                    if(configs.servers[msg.channel.server.id].customroles[1].length>0 || configs.servers[msg.channel.server.id].customroles[2]) {
                        info = "Select one of the following:";
                        var availableRoles = [];
                        for(var i=0; i<configs.servers[msg.channel.server.id].customroles[1].length; i++) {
                            var role = msg.channel.server.roles.get("id", configs.servers[msg.channel.server.id].customroles[1][i]);
                            if(role) {
                                info += "\n\t" + availableRoles.length + ") " + role.name;
                                availableRoles.push(role.name);
                            }
                        }
                        if(configs.servers[msg.channel.server.id].customroles[2]) {
                            info += "\n\t " + "*Custom roles*";
                        }
                        bot.sendMessage(msg.channel, info);
                        if(availableRoles.length>0) {
                            selectMenu(msg.channel, msg.author.id, function(i) {
                                commands.role.process(bot, msg, availableRoles[i]);
                            }, availableRoles.length-1);
                        }
                    } else {
                        bot.sendMessage(msg.channel, "Setting roles is disabled in this server, sorry.");
                    }
                }
            } else {
                bot.sendMessage(msg.channel, "Well, uh, this is weird but the server admins have this command basically disabled :/");
            }
        }
    },
    // Get a user's full profile
    "profile": {
        usage: "[<username>]",
        process: function(bot, msg, suffix) {
            var usr;
            if(!suffix || suffix.toLowerCase()=="me") {
                usr = msg.author;
            } else if(suffix.split(",").length>=2) {
                var key = suffix.substring(0, suffix.indexOf(",")).toLowerCase().trim();
                var value = suffix.substring(suffix.indexOf(",")+1).trim();
                if(!key || !value) {
                    logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, msg.author.username + " did not specify parameters for profile data");
                    bot.sendMessage(msg.channel, msg.author + " Uh, use the syntax `" + getPrefix(msg.channel.server) + "profile <key>,<value>`");
                } else if(["messages", "active", "seen", "mentions", "strikes"].indexOf(key)>-1) {
                    logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, msg.author.username + " tried to assign default stats profile value");
                    bot.sendMessage(msg.channel, msg.author + " You can't change the value for " + key);
                } else if(stats[msg.channel.server.id].members[msg.author.id] && stats[msg.channel.server.id].members[msg.author.id][key] && value==".") {
                    delete stats[msg.channel.server.id].members[msg.author.id][key];
                    logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Deleted key " + key + " from " + msg.author.username + "'s stats profile");
                    bot.sendMessage(msg.channel, "*Poof, gone.*");
                } else {
                    stats[msg.channel.server.id].members[msg.author.id][key] = value;
                    logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Saved new key " + key + " in " + msg.author.username + "'s stats profile");
                    bot.sendMessage(msg.channel, "K, TIL.");
                }
                return;
            } else {
                usr = userSearch(suffix, msg.channel.server);
            }
            if(usr) {
                var data = getProfile(usr, msg.channel.server);
                var info = "";
                for(var sect in data) {
                    info += "**" + sect + ":**\n";
                    for(var key in data[sect]) {
                        info += "\t" + key + ": " + data[sect][key] + "\n";
                    }
                }
                bot.sendMessage(msg.channel, info);
            } else {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Requested member does not exist so profile cannot be shown");
                bot.sendMessage(msg.channel, "That user doesn't exist :/");
            }
        }
    },
    // Quickly get the number of messages a user has
    "messages": {
        usage: "<username>",
        process: function(bot, msg, suffix) {
            if(configs.servers[msg.channel.server.id].stats) {
                var usr;
                if(!suffix) {
                    var memberMessages = [];
                    for(var usrid in stats[msg.channel.server.id].members) {
                        usr = msg.channel.server.members.get("id", usrid);
                        if(usr && stats[msg.channel.server.id].members[usrid].messages>0) {
                            memberMessages.push([getName(msg.channel.server, usr), stats[msg.channel.server.id].members[usrid].messages]);
                        }
                    }
                    memberMessages.sort(function(a, b) {
                        return a[1] - b[1];
                    });
                    var info = "";
                    for(var i=memberMessages.length-1; i>=0; i--) {
                        var tmpinfo = "**@" + memberMessages[i][0] + "**: " + memberMessages[i][1] + " message" + (memberMessages[i][1]==1 ? "" : "s") + " this week\n";
                        if((tmpinfo.length + info.length)>2000) {
                            break;
                        } else {
                            info += tmpinfo;
                        }
                    }
                    bot.sendMessage(msg.channel, info);
                    return;
                }
                if(suffix.toLowerCase()=="me") {
                    usr = msg.author;
                } else {
                    usr = userSearch(suffix, msg.channel.server);
                }
                if(usr) {
                    checkStats(usr.id, msg.channel.server.id);
                    bot.sendMessage(msg.channel, "**@" + getName(msg.channel.server, usr) + "** has sent `" + stats[msg.channel.server.id].members[usr.id].messages + "` message" + (stats[msg.channel.server.id].members[usr.id].messages==1 ? "" : "s") + " on this server this week");
                } else {
                    logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Requested member does not exist so number of messages cannot be shown");
                    bot.sendMessage(msg.channel, "That user doesn't exist :/");
                }
            }
        }
    },
    // Quickly gets a user's avatar
    "avatar": {
        usage: "<username> [imgur]",
        process: function(bot, msg, suffix) {
            var usr;
            if(!suffix || suffix.toLowerCase()=="me") {
                usr = msg.author;
            } else {
                usr = userSearch(suffix, msg.channel.server);
            }
            if(usr) {
                var useImgur = suffix.length>5 && suffix.substring(suffix.length-5).toLowerCase()=="imgur";
                if(!usr.avatarURL) {
                    bot.sendFile(msg.channel, "http://i.imgur.com/fU70HJK.png");
                } else {
                    if(useImgur) {
                        imgur.upload(usr.avatarURL, function(err, res) {
                            if(err) {
                                bot.sendFile(msg.channel, usr.avatarURL);
                            } else {
                                bot.sendFile(msg.channel, res.data.link);
                            }
                        });
                    } else {
                        bot.sendFile(msg.channel, usr.avatarURL);
                    }
                }
            } else {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Requested member does not exist so avatar cannot be shown");
                bot.sendMessage(msg.channel, "I don't know who that is, so you can look at my beautiful face instead:", function() {
                    bot.sendFile(msg.channel, bot.user.avatarURL || "http://i.imgur.com/fU70HJK.png");
                });
            }
        }
    },
    // Google Play Store bot
    "linkme": {
        usage: "<app1>[,<app2>,...]",
        process: function(bot, msg, suffix) {
            var apps = getAppList(suffix);
            if(apps.length>0) {
                for(var i=0; i<apps.length; i++) {
                    var basePath = "https://play.google.com/store/search?&c=apps&q=" + apps[i] + "&hl=en";
                    var data;
                    // Scrapes Play Store search results webpage for information
                    var u;
                    unirest.get(basePath)
                    .end(function(response) {
                        data = scrapeSearch(response.raw_body);
                        var send = "";
                        if(data.items[0]) {
                            send = data.items[0].name + " by " + data.items[0].company + ", ";
                            if(data.items[0].price.indexOf("$")>-1) {
                                send += data.items[0].price.substring(0, data.items[0].price.lastIndexOf("$"));
                            } else {
                                send += "free"
                            }
                            send += " and rated " + data.items[0].rating + " stars: " + data.items[0].url + "\n";
                        } else {
                            logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "App " + apps[i] + " not found to link for " + msg.author.username);
                            send = msg.author + " Sorry, no such app exists.\n";
                        }
                        bot.sendMessage(msg.channel, send);
                    });
                }
            } else {
                bot.sendMessage(msg.channel, "https://play.google.com/store/apps");
            }
        }
    },
    // Apple App Store bot
    "appstore": {
        usage: "<app1>[,<app2>,...]",
        process: function(bot, msg, suffix) {
            var apps = getAppList(suffix);
            if(apps.length>0) {
                for(var i=0; i<apps.length; i++) {
                    itunes({
                        entity: "software",
                        country: "US",
                        term: apps[i],
                        limit: 1
                    }, function (err, data) {
                        var send = "";
                        if(!err) {
                            send = data.results[0].trackCensoredName + " by " + data.results[0].artistName + ", " + data.results[0].formattedPrice + " and rated " + data.results[0].averageUserRating + " stars: " + data.results[0].trackViewUrl + "\n";
                        } else {
                            logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "App " + apps[i] + " not found to link for " + msg.author.username);
                            send = msg.author + " Sorry, no such app exists.\n";
                        }
                        bot.sendMessage(msg.channel, send);
                    });
                }
            } else {
                bot.sendMessage(msg.channel, "http://www.apple.com/itunes/charts/free-apps/");
            }
        }
    },
    // Quickly gets a user's points
    "points": {
        usage: "[<username or \"lottery\">]",
        process: function(bot, msg, suffix) {
            // Show points for user
            var usr;
            if(!suffix) {
                var memberPoints = [];
                for(var usrid in profileData) {
                    usr = msg.channel.server.members.get("id", usrid);
                    if(usr && profileData[usr.id].points>0) {
                        memberPoints.push([getName(msg.channel.server, usr), profileData[usr.id].points]);
                    }
                }
                memberPoints.sort(function(a, b) {
                    return a[1] - b[1];
                });
                var info = "";
                for(var i=memberPoints.length-1; i>=0; i--) {
                    var tmpinfo = "**@" + memberPoints[i][0] + "**: " + memberPoints[i][1] + " AwesomePoint" + (memberPoints[i][1]==1 ? "" : "s") + "\n";
                    if((tmpinfo.length + info.length)>2000) {
                        break;
                    } else {
                        info += tmpinfo;
                    }
                }
                bot.sendMessage(msg.channel, info);
                return;
            // PointsBall lottery game!
            } else if(suffix=="lottery" && configs.servers[msg.channel.server.id].lottery) {
                // Start new lottery in server (winner in 60 minutes)
                if(!lottery[msg.channel.server.id]) {
                    lottery[msg.channel.server.id] = {
                        members: [],
                        timestamp: Date.now(),
                        timer: setTimeout(function() {
                            endLottery(msg.channel);
                        }, 3600000)
                    };
                    logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Lottery started, ends in 60 minutes");
                }

                // Buy a lottery ticket
                if(!profileData[msg.author.id]) {
                    profileData[msg.author.id] = {
                        points: 0
                    }
                }
                var cost = pointsball<500 ? Math.ceil(pointsball/7) : Math.ceil(pointsball/10)
                if(profileData[msg.author.id].points>=cost) {
                    profileData[msg.author.id].points -= cost;
                    lottery[msg.channel.server.id].members.push(msg.author.id);
                    logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, msg.author.username + " bought a lottery ticket");
                    bot.sendMessage(msg.channel, msg.author + " Thanks for buying a PointsBall ticket. That cost you " + cost + " points. The lottery will end in " + secondsToString((lottery[msg.channel.server.id].timestamp + 3600000 - Date.now())/1000));
                } else {
                    logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, msg.author.username + " does not have enough points to buy a lottery ticket");
                    bot.sendMessage(msg.channel, msg.author + " You're not rich enough to participate in the 1%-only lottery :P");
                }
                return;
            } else if(suffix=="lottery end") {
                // End lottery and pick winner
                if(lottery[msg.channel.server.id]) {
                    clearTimeout(lottery[msg.channel.server.id].timer);
                    endLottery(msg.channel);
                } else {
                    logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Cannot end lottery, not started");
                    bot.sendMessage(msg.channel, msg.author + " A lottery hasn't been started yet in this server. Please use `" + getPrefix(msg.channel.server) + "points lottery` to start one.");
                }
                return;
            } else if(suffix.toLowerCase()=="me") {
                usr = msg.author;
            } else {
                usr = userSearch(suffix, msg.channel.server);
            }
            if(usr) {
                if(!profileData[usr.id]) {
                    profileData[usr.id] = {
                        points: 0
                    }
                }
                bot.sendMessage(msg.channel, "**@" + getName(msg.channel.server, usr) + "** has `" + profileData[usr.id].points + "` AwesomePoint" + (profileData[usr.id].points==1 ? "" : "s"));
            } else {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Requested member does not exist so profile cannot be shown");
                bot.sendMessage(msg.channel, "That user doesn't exist :confused:");
            }
        }
    },
    // List ranks with users
    "ranks": {
        usage: "[<username or rank>]",
        process: function(bot, msg, suffix) {
            var usr;
            if(!suffix) {
                var info = "";
                for(var i=configs.servers[msg.channel.server.id].rankslist.length-1; i>=0; i--) {
                    var membersWithRank = getMembersWithRank(msg.channel.server, configs.servers[msg.channel.server.id].rankslist[i]);
                    if(membersWithRank.length>0) {
                        membersWithRank.sort(function(a, b) {
                            b = a[0].toUpperCase();
                            a = b[0].toUpperCase();
                            return a < b ? -1 : a > b ? 1 : 0;
                        });
                        var tmpinfo = "**" + configs.servers[msg.channel.server.id].rankslist[i].name + "** (" + membersWithRank.length + ")\n" + membersWithRank.join("");
                        if((tmpinfo.length + info.length)>2000) {
                            break;
                        } else {
                            info += tmpinfo;
                        }
                    }
                }
                bot.sendMessage(msg.channel, info);
                return;
            } else if(suffix.toLowerCase()=="me") {
                usr = msg.author;
            } else {
                usr = userSearch(suffix, msg.channel.server);
            }
            if(usr) {
                bot.sendMessage(msg.channel, "**@" + getName(msg.channel.server, usr) + "** has rank `" + stats[msg.channel.server.id].members[msg.author.id].rank + "`");
            } else {
                for(var i=configs.servers[msg.channel.server.id].rankslist.length-1; i>=0; i--) {
                    if(suffix.toLowerCase()==configs.servers[msg.channel.server.id].rankslist[i].name.toLowerCase()) {
                        var membersWithRank = [];
                        for(var usrid in stats[msg.channel.server.id].members) {
                            if(stats[msg.channel.server.id].members[usrid].rank==configs.servers[msg.channel.server.id].rankslist[i].name) {
                                var usr = msg.channel.server.members.get("id", usrid);
                                if(usr) {
                                    membersWithRank.push("\t@" + getName(msg.channel.server, usr) + "\n");
                                }
                            }
                        }
                        if(membersWithRank.length>0) {
                            membersWithRank.sort(function(a, b) {
                                b = a[0].toUpperCase();
                                a = b[0].toUpperCase();
                                return a < b ? -1 : a > b ? 1 : 0;
                            });
                            bot.sendMessage(msg.channel, "**" + configs.servers[msg.channel.server.id].rankslist[i].name + "** (" + membersWithRank.length + ")\n" + membersWithRank.join(""));
                        } else {
                            bot.sendMessage(msg.channel, "No one has the rank `" + configs.servers[msg.channel.server.id].rankslist[i].name + "`.");
                        }
                        return;
                    }
                }

                var rankOptions = [];
                for(var i=0; i<configs.servers[msg.channel.server.id].rankslist.length; i++) {
                    rankOptions.push(i + ") " + configs.servers[msg.channel.server.id].rankslist[i].name);
                }
                bot.sendMessage(msg.channel, "Select one of the following:\n\t" + rankOptions.join("\n\t"));
                selectMenu(msg.channel, msg.author.id, function(i) {
                    commands.ranks.process(bot, msg, rankOptions[i].substring(rankOptions[i].indexOf(")")+2));
                }, rankOptions.length-1);
            }
        }
    },
    // Fetches today's XKCD comic or by ID
    "xkcd": {
        usage: "[<comic ID>]",
        process: function(bot, msg, suffix) {
            unirest.get("http://xkcd.com/1691/info.0.json")
            .headers({
                "Accept": "application/json"
            })
            .end(function(result) {
                if(result.status==200) {
                    if(suffix) {
                        if(!isNaN(suffix) && suffix>0 && suffix<result.body.num) {
                            unirest.get("http://xkcd.com/" + suffix + "/info.0.json")
                            .headers({
                                "Accept": "application/json"
                            })
                            .end(function(result) {
                                if(result.status==200) {
                                    bot.sendMessage(msg.channel, "__" + result.body.title + "__```" + result.body.alt + "```" + result.body.img);
                                } else {
                                    logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to fetch XKCD " + suffix);
                                    bot.sendMessage(msg.channel, "Nooooo, something screwed up :scream:");
                                }
                            });
                        } else {
                            logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "Invalid ID provided for xkcd");
                            bot.sendMessage(msg.channel, msg.author + " Let's start with *what is a number?* :unamused:");
                        }
                    } else {
                        bot.sendMessage(msg.channel, "__" + result.body.title + "__```" + result.body.alt + "```" + result.body.img);
                    }
                } else {
                    logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to fetch latest XKCD");
                    bot.sendMessage(msg.channel, "Nooooo, something screwed up :scream:");
                }
            });
        }
    },
    // Gets a joke from the Interwebs
    "joke": {
        process: function(bot, msg) {
            jokesearch.getJoke(function(joke) {
                bot.sendMessage(msg.channel, joke);
            });
        }
    },
    "translate": {
        usage: "<text> <source lang> to <target lang>",
        process: function(bot, msg, suffix) {
            var toi = suffix.lastIndexOf(" to ");
            if(toi==-1) {
                logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, "User used incorrect translation syntax");
                bot.sendMessage(msg.channel, msg.author + " Sorry, I didn't get that. Make sure you're using the right syntax: `" + getPrefix(msg.channel.server) + "translate <text> <source lang> to <target lang>`");
            } else {
                var target = suffix.substring(suffix.lastIndexOf(" to ")+4);
                suffix = suffix.substring(0, suffix.lastIndexOf(" to "));
                var source = suffix.substring(suffix.lastIndexOf(" ")+1);
                var text = suffix.substring(0, suffix.lastIndexOf(" "));

                bingTranslate.translate(text, source, target, function(err, result) {
                    if(err) {
                        logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to translate '" + text + "'");
                        bot.sendMessage(msg.channel, "I got an error when I tried to translate that. I probably don't support that language.");
                    } else {
                        bot.sendMessage(msg.channel, "`" + result.translated_text + "`");
                    }
                });
            }
        }
    },
    // Displays list of options and RSS feeds
    "help": {
        usage: "[<command name>] [\"public\"]",
        process: function(bot, msg, suffix) {
            if(!suffix) {
                sendArray(msg.author, ["Use the syntax `" + getPrefix(msg.channel.server) + "<command> <params>` (without the angle brackets) in the main chat. The following commands are available:"].concat(getHelp(msg.channel.server, msg.author)));
                bot.sendMessage(msg.channel, msg.author + " Check your PMs");
            } else if(suffix.toLowerCase()=="public") {
                sendArray(msg.channel, ["Use the syntax `" + getPrefix(msg.channel.server) + "<command> <params>` (without the angle brackets). The following commands are available:"].concat(getHelp(msg.channel.server, msg.author)));
            } else {
                if(suffix.indexOf(" ")>-1 && suffix.substring(suffix.indexOf(" ")+1).toLowerCase()=="public" && suffix.substring(0, suffix.indexOf(" "))) {
                    bot.sendMessage(msg.channel, getCommandHelp(msg.channel.server, suffix.substring(0, suffix.indexOf(" ")).toLowerCase()));
                } else {
                    bot.sendMessage(msg.author, getCommandHelp(msg.channel.server, suffix.toLowerCase()));
                    bot.sendMessage(msg.channel, msg.author + " Check your PMs");
                }
            }
        }
    }
};

var pmcommands = {
    // Configuration options in wizard or online for maintainer and admins
    "config": {
        usage: "[<server>]",
        process: function(bot, msg, suffix) {
            // Maintainer control panel for overall bot things
            if(msg.author.id==configs.maintainer && !suffix && !maintainerconsole) {
                logMsg(Date.now(), "INFO", "General", null, "Maintainer console opened");
                if(configs.hosting) {
                    if(!onlineconsole[msg.author.id] && !adminconsole[msg.author.id]) {
                        onlineconsole[msg.author.id] = {
                            token: genToken(30),
                            type: "maintainer",
                            timer: setTimeout(function() {
                                logMsg(Date.now(), "INFO", "General", null, "Timeout on online maintainer console");
                                delete onlineconsole[msg.author.id];
                            }, 300000)
                        };
                    } else if(onlineconsole[msg.author.id]) {
                        bot.sendMessage(msg.channel, "You already have an online console session open. Logout of that first or wait 5 minutes...");
                        return;
                    } else if(adminconsole[msg.author.id]) {
                        bot.sendMessage(msg.channel, "One step at a time...Finish configuring this server, then come back later!");
                        return;
                    }

                    var url = (configs.hosting.charAt(configs.hosting.length-1)=='/' ? configs.hosting.substring(0, configs.hosting.length-1) : configs.hosting) + "?auth=" + onlineconsole[msg.author.id].token;
                    bot.sendMessage(msg.channel, url);
                } else {
                    bot.sendMessage(msg.channel, "You have not provided a hosting URL in the bot config, so the maintainer console is not available.");
                }
            }

            // Admin control panel, check to make sure the config command was valid
            if(suffix) {
                var svr = serverSearch(suffix, msg.author);
                // Check if specified server exists
                if(!svr) {
                    bot.sendMessage(msg.channel, "Sorry, invalid server. Try again?");
                // Check if sender is an admin of the specified server
                } else if(configs.servers[svr.id].admins.indexOf(msg.author.id)>-1) {
                    // Check to make sure no one is already using the console
                    if(onlineconsole[msg.author.id] || adminconsole[msg.author.id]) {
                        bot.sendMessage(msg.channel, "You already have an online console session open. Logout of that first or wait 5 minutes...");
                        return;
                    }
                    if(!activeAdmins(svr.id)) {
                        // Ok, all conditions met, logged into admin console
                        if(configs.hosting) {
                            logMsg(Date.now(), "INFO", null, msg.author.id, "Admin console launched for " + svr.name);
                            adminconsole[msg.author.id] = svr.id;
                            onlineconsole[msg.author.id] = {
                                token: genToken(30),
                                type: "admin",
                                svrid: svr.id,
                                timer: setTimeout(function() {
                                    logMsg(Date.now(), "INFO", null, msg.author.id, "Timeout on online admin console for " + svr.name);
                                    delete adminconsole[msg.author.id];
                                    delete onlineconsole[msg.author.id];
                                }, 300000)
                            };

                            var url = (configs.hosting.charAt(configs.hosting.length-1)=='/' ? configs.hosting.substring(0, configs.hosting.length-1) : configs.hosting) + "?auth=" + onlineconsole[msg.author.id].token;
                            bot.sendMessage(msg.channel, url);
                        } else {
                            bot.sendMessage(msg.channel, "The bot maintainer has not provided a hosting URL, so the admin console is not available.");
                        }
                    } else {
                        logMsg(Date.now(), "WARN", null, msg.author.id, "Admin console for " + svr.name + " already active");
                        bot.sendMessage(msg.channel, "Another admin is in the console already. Please try again later.");
                    }
                } else {
                    logMsg(Date.now(), "WARN", null, msg.author.id, "User is not a bot admin of " + svr.name);
                    bot.sendMessage(msg.channel, "You are not an admin for that server.");
                }
            }
        }
    },
    // Set a reminder with natural language
    "remindme": {
        usage: commands.remindme.usage,
        process: function(bot, msg, suffix) {
            if(suffix) {
                parseReminder(suffix, msg.author, msg.channel);
            } else {
                logMsg(Date.now(), "WARN", null, msg.author.id, "User did provide remindme parameters");
                bot.sendMessage(msg.channel, "You know - I don't like people like you, expecting me to do things without even giving me any info!");
            }
        }
    },
    // Lists all active reminders
    "reminders": {
        usage: "[<reminder note to cancel>]",
        process: function(bot, msg, suffix) {
            if(!suffix) {
                var info = "";
                for(var i=0; i<reminders.length; i++) {
                    if(reminders[i].user==msg.author.id) {
                        info += "**" + reminders[i].note + "** in " + secondsToString((reminders[i].time - Date.now()) / 1000) + "\n";
                    }
                }
                if(!info) {
                    info = "Hmmm, you haven't set any reminders recently. Reply with `remindme <no.> <h, m, or s> <note>` to set one.";
                }
                bot.sendMessage(msg.author, info);
            } else {
                for(var i=0; i<reminders.length; i++) {
                    if(reminders[i].user==msg.author.id && reminders[i].note.toLowerCase()==suffix.toLowerCase()) {
                        logMsg(Date.now(), "INFO", null, msg.author.id, "Cancelled reminder set at " + prettyDate(new Date(reminders[i].time)));
                        reminders.splice(i, 1);
                        bot.sendMessage(msg.author, "Got it, I won't remind you.");
                        saveData("./data/reminders.json", function(err) {
                            if(err) {
                                logMsg(Date.now(), "ERROR", null, msg.author.id, "Failed to cancel reminder");
                            }
                        });
                        return;
                    }
                }
                logMsg(Date.now(), "INFO", null, msg.author.id, "Could not find matching reminder to cancel");
                bot.sendMessage(msg.author, "Sorry, I couldn't find a reminder like that. Use `remindme <no.> <h, m, or s> " + suffix + "` to set it.");
            }
        }
    },
    // Modify the value for a key in a user's profile
    "profile": {
        usage: "<key>|<value or \".\">",
        process: function(bot, msg, suffix) {
            if(suffix) {
                if(msg.content.indexOf("|")==-1) {
                    logMsg(Date.now(), "WARN", null, msg.author.id, "User did not specify parameters for profile data");
                    bot.sendMessage(msg.channel, "Please include the name of the value as well as the value itself, separated by a comma.");
                    return;
                }
                var key = msg.content.substring(8, msg.content.indexOf("|")).trim();
                var value = msg.content.substring(msg.content.indexOf("|")+1).trim();
                if(["id", "status", "points", "afk", "past names", "svrnicks"].indexOf(key.toLowerCase())>-1) {
                    logMsg(Date.now(), "WARN", null, msg.author.id, "User tried to assign default profile value");
                    bot.sendMessage(msg.channel, "You can't change the value for " + key);
                    return;
                }
                var info = "";
                if(value=="." && profileData[msg.author.id]) {
                    if(!profileData[msg.author.id][key]) {
                        logMsg(Date.now(), "WARN", null, msg.author.id, "User tried to delete a nonexistent profile value");
                        bot.sendMessage(msg.channel, "I didn't have anything for " + key + " in the first place.");
                        return;
                    }
                    info = "Deleted.";
                    delete profileData[msg.author.id][key];
                } else {
                    if(!profileData[msg.author.id]) {
                        profileData[msg.author.id] = {
                            points: 0
                        };
                    }
                    info = "Alright, got it! PM me `profile " + key + "|.` to delete that.";
                    profileData[msg.author.id][key] = value;
                }
                bot.sendMessage(msg.channel, info);
            } else {
                logMsg(Date.now(), "WARN", null, msg.author.id, "User did not provide profile parameters");
                bot.sendMessage(msg.channel, "C'mon, I need something to work with here!");
            }
        }
    },
    // Discreet say command
    "say": {
        usage: "<server> <channel> <something to say>",
        process: function(bot, msg, suffix) {
            if(suffix) {
                var svrnm = msg.content.substring(msg.content.indexOf(" ")+1);
                var svr;
                do {
                    svrnm = svrnm.substring(0, svrnm.lastIndexOf(" "));
                    svr = serverSearch(svrnm, msg.author);
                } while(!svr && svrnm.length>0);
                if(!svr) {
                    bot.sendMessage(msg.channel, "Huh, that's not a server I know of.");
                    return;
                }
                if(configs.servers[svr.id].admins.indexOf(msg.author.id)==-1) {
                    logMsg(Date.now(), "WARN", null, msg.author.id, "Cannot say because user is not a bot admin in " + svr.name);
                    bot.sendMessage(msg.channel, "You're not an admin in that server :P");
                    return;
                }
                var chnm = msg.content.substring(svrnm.length+5);
                chnm = chnm.substring(0, chnm.indexOf(" "));
                var ch = channelSearch(chnm, svr);
                if(!ch) {
                    logMsg(Date.now(), "WARN", null, msg.author.id, "User provided invalid channel for discreet say");
                    bot.sendMessage(msg.channel, "There's no such channel on " + svr.name);
                    return;
                }
                var suffix = msg.content.substring(svrnm.length+chnm.length+6);
                if(!suffix) {
                    logMsg(Date.now(), "WARN", null, msg.author.id, "No discreet message to say in " + svr.name + ", " + ch.name);
                    bot.sendMessage(msg.channel, "Idk what to say...Please use the syntax `say " + svr.name + " " + ch.name + " <something to say>`");
                    return;
                }
                bot.sendMessage(msg.channel, "Alright, check #" + ch.name)
                bot.sendMessage(ch, suffix);
                logMsg(Date.now(), "INFO", svr.id, ch.id, "Saying '" + suffix + "' at admin's request via PM");
            } else {
                logMsg(Date.now(), "WARN", null, msg.author.id, "User did provide parameters for discreet say command");
                bot.sendMessage(msg.channel, "Whaaaa...Make sure you read the help section for this command. I need a server, channel, and something to say (in that order).");
            }
        }
    },
    // Start a giveaway
    "giveaway": {
        usage: "<server> <channel> <name of giveaway>|<secret>[|<giveaway duration>]",
        process: function(bot, msg, suffix) {
            if(suffix) {
                if(suffix.toLowerCase()=="close") {
                    if(giveaways[msg.author.id]) {
                        endGiveaway(msg.author);
                    } else {
                        logMsg(Date.now(), "WARN", null, msg.author.id, "User tried to close nonexistent giveaway");
                        bot.sendMessage(msg.channel, "You haven't started a giveaway yet. Use `giveaway <server> <channel> <name of giveaway>|<secret>`");
                    }
                    return;
                }
                if(giveaways[msg.author.id]) {
                    logMsg(Date.now(), "WARN", null, msg.author.id, "User already has a giveaway open and cannot start new one");
                    bot.sendMessage(msg.channel, "You already have a giveaway open. Use `giveaway close` to end it.");
                    return;
                }
                var svrnm = msg.content.substring(msg.content.indexOf(" ")+1);
                var svr;
                do {
                    svrnm = svrnm.substring(0, svrnm.lastIndexOf(" "));
                    svr = serverSearch(svrnm, msg.author);
                } while(!svr && svrnm.length>0);
                if(!svr) {
                    bot.sendMessage(msg.channel, "Huh, that's not a server I know of.");
                    return;
                }
                if(configs.servers[svr.id].admincommands.indexOf("giveaway")>-1 && configs.servers[svr.id].admins.indexOf(msg.author.id)==-1) {
                    logMsg(Date.now(), "WARN", null, msg.author.id, "Cannot start giveaway because user is not a bot admin in " + svr.name);
                    bot.sendMessage(msg.channel, "You're not an admin in that server :P");
                    return;
                }
                var chnm = suffix.substring(svrnm.length+1);
                chnm = chnm.substring(0, chnm.indexOf(" "));
                var ch = channelSearch(chnm, svr);
                if(!ch) {
                    logMsg(Date.now(), "WARN", null, msg.author.id, "User provided invalid channel for giveaway");
                    bot.sendMessage(msg.channel, "There's no such channel on " + svr.name);
                    return;
                }
                if(!configs.servers[svr.id].giveaway || (configs.servers[svr.id].chrestrict[ch.id] && configs.servers[svr.id].chrestrict[ch.id].indexOf("giveaway")>-1)) {
                    bot.sendMessage(msg.channel, "Giveaways aren't allowed on #" + ch.name + " in " + svr.name + ". They encourage hoarding over there, I guess.");
                    return;
                }
                var suffix = suffix.substring(svrnm.length+1);
                suffix = suffix.substring(suffix.indexOf(" "));
                if([2, 3].indexOf(suffix.split("|").length)>-1) {
                    var time = {
                        num: 1,
                        time: "hour",
                        countdown: 3600000
                    };
                    if(suffix.split("|")[2]) {
                        time = parseTime(suffix.split("|")[2]);
                        if(!time) {
                            logMsg(Date.now(), "WARN", null, msg.author.id, "User provided invalid giveaway time");
                            bot.sendMessage(msg.channel, "For the giveaway duration, use the syntax `<no.> <h, m, or s>`");
                            return;
                        } else if(time.countdown>14400000) {
                            logMsg(Date.now(), "WARN", null, msg.author.id, "User provided excessively large giveaway time");
                            bot.sendMessage(msg.channel, "It's probably not a good idea to make the giveaway last more than 4 hours...");
                            return;
                        }
                    }

                    if(!suffix.split("|")[0] || !suffix.split("|")[1]) {
                        logMsg(Date.now(), "WARN", null, msg.author.id, "User did not provide giveaway name and/or secret");
                        bot.sendMessage(msg.channel, "I need a name and secret as well, separated by `|`.");
                        return;
                    }
                    if(getGiveaway(suffix.split("|")[0].trim())) {
                        logMsg(Date.now(), "WARN", null, msg.author.id, "User tried to overwrite existing giveaway");
                        bot.sendMessage(msg.channel, "A giveaway with that name already exists on the server; pick a different name.");
                        return;
                    }

                    logMsg(Date.now(), "INFO", null, msg.author.id, "Started giveaway " + suffix.split("|")[0].trim() + " for " + time.num + " " + time.time);
                    giveaways[msg.author.id] = {
                        name: suffix.split("|")[0].trim(),
                        secret: suffix.split("|")[1],
                        channel: ch.id,
                        enrolled: []
                    };
                    saveData("./data/giveaways.json", function(err) {
                        if(err) {
                            logMsg(Date.now(), "ERROR", "General", null, "Failed to save updated giveaways data");
                        }
                    });
                    bot.sendMessage(msg.author, "Gotcha, giveaway started in #" + ch.name + " of " + svr.name);
                    bot.sendMessage(ch, "**" + msg.author + " has started a giveaway: " + suffix.split("|")[0].trim()+ ".** Use `" + getPrefix(svr) + "giveaway " + suffix.split("|")[0].trim() + "` for a chance to win!");

                    setTimeout(function() {
                        endGiveaway(msg.author);
                    }, time.countdown);
                } else {
                    logMsg(Date.now(), "WARN", null, msg.author.id, "User used invalid giveaway syntax");
                    bot.sendMessage(msg.channel, "Please use `giveaway " + svr.name + " " + ch.name + " <name of giveaway>|<secret>[|<giveaway duration>]");
                }
            } else {
                logMsg(Date.now(), "WARN", null, msg.author.id, "User did not provide parameters for giveaway command");
                bot.sendMessage(msg.channel, "Whaaaa...Make sure you read the help section for this command. I need a server, channel, and giveaway parameters.");
            }
        }
    },
    // Set a shortcut for a server
    "servernick": {
        usage: "<nickname>|<server or \".\">",
        process: function(bot, msg, suffix) {
            if(suffix && suffix.split("|").length==2 && suffix.split("|")[0] && suffix.split("|")[1]) {
                if(profileData[msg.author.id] && profileData[msg.author.id].svrnicks && profileData[msg.author.id].svrnicks[suffix.split("|")[0].toLowerCase()]) {
                    if(suffix.split("|")[1]==".") {
                        delete profileData[msg.author.id].svrnicks[suffix.split("|")[0].toLowerCase()];
                        logMsg(Date.now(), "INFO", null, msg.author.id, "Deleted shortcut '" + suffix.split("|")[0] + "'");
                        bot.sendMessage(msg.channel, "Alrighty!");
                    } else {
                        logMsg(Date.now(), "WARN", null, msg.author.id, "User tried to overwrite server nick");
                        bot.sendMessage(msg.channel, "You already have a server set for that shortcut, use `servernick " + suffix.split("|")[0] + "|.` to remove it.");
                    }
                    return;
                }
                var svr = serverSearch(suffix.split("|")[1], msg.author);
                if(svr) {
                    if(!profileData[msg.author.id]) {
                        profileData[msg.author.id] = {
                            points: 0
                        };
                    }
                    if(!profileData[msg.author.id].svrnicks) {
                        profileData[msg.author.id].svrnicks = {};
                    }
                    profileData[msg.author.id].svrnicks[suffix.split("|")[0].toLowerCase()] = svr.id;
                    logMsg(Date.now(), "INFO", null, msg.author.id, "Created server nick '" + suffix.split("|")[0] + "' for " + svr.name);
                    bot.sendMessage(msg.channel, "You will now be able to use `" + suffix.split("|")[0] + "` to access " + svr.name);
                } else {
                    bot.sendMessage(msg.channel, "Check ur priv bruh");
                }
            } else if(!suffix) {
                if(profileData[msg.author.id] && profileData[msg.author.id].svrnicks && Object.keys(profileData[msg.author.id].svrnicks).length>0) {
                    var info = "You've set the following server nicks:";
                    var svrnicksinfo = [];
                    for(var nick in profileData[msg.author.id].svrnicks) {
                        var svr = bot.servers.get("id", profileData[msg.author.id].svrnicks[nick]);
                        if(checkServer(svr, msg.author)) {
                            svrnicksinfo.push("\n\t" + nick + ": " + svr.name);
                        }
                    }
                    if(svrnicksinfo.length>0) {
                        info += svrnicksinfo.sort().join("") + "\n*Use `servernick <nickanme>|.` to remove one.*";
                        bot.sendMessage(msg.channel, info);
                        return;
                    }
                }
                bot.sendMessage(msg.channel, "You haven't set any nicks for servers. They're really useful though! They save a ton of time! Try setting one with `servernick <nickname>|<server>`");
            } else {
                logMsg(Date.now(), "WARN", null, msg.author.id, "User provided invalid servernick parameters");
                bot.sendMessage(msg.channel, "I got nothin for ya bro, make sure you're using the right syntax: `servernick <nickname>|<server or \".\">`");
            }
        }
    },
    // Strawpoll-like poll creation
    "poll": {
        usage: "<server> <channel>",
        process: function(bot, msg, suffix) {
            // End poll if it has been initialized previously
            if(polls[msg.author.id] && msg.content.toLowerCase().indexOf("poll close")==0) {
                bot.sendMessage(msg.channel, "Poll ended.");
                var ch = bot.channels.get("id", polls[msg.author.id].channel);

                if(ch && ch.server) {
                    // Displays poll results if voting had occurred
                    if(polls[msg.author.id].open) {
                        bot.sendMessage(ch, pollResults(msg.author.id, "The results are in", "and the winner is"));
                    }

                    // Clear out all the poll stuff
                    logMsg(Date.now(), "INFO", null, msg.author.id, "Poll ended in " + ch.name + ", " + ch.server.name);
                }
                delete polls[msg.author.id];
                saveData("./data/polls.json", function(err) {
                    if(err) {
                        logMsg(Date.now(), "ERROR", "General", null, "Failed to save updated polls data");
                    }
                });
                return;
            }
            // Starts a poll in a given channel via private message
            if(msg.author.id!=bot.user.id && msg.content.toLowerCase().indexOf("poll")==0) {
                var svr = serverSearch(msg.content.substring(msg.content.indexOf(" ")+1, msg.content.lastIndexOf(" ")), msg.author);
                if(!svr || !svr.members.get("id", msg.author.id)) {
                    bot.sendMessage(msg.channel, "That server doesn't exist or I'm not on it.");
                } else if(configs.servers[svr.id].blocked.indexOf(msg.author.id)==-1) {
                    var ch = svr.channels.get("name", msg.content.substring(msg.content.lastIndexOf(" ")+1));
                    if(!ch || !ch.server) {
                        logMsg(Date.now(), "WARN", null, msg.author.id, "Invalid channel provided for new poll");
                        bot.sendMessage(msg.channel, "Invalid channel.");
                    } else if(stats[svr.id].botOn[ch.id]) {
                        if(configs.servers[svr.id].poll && (configs.servers[svr.id].admincommands.indexOf("poll")==-1 || configs.servers[svr.id].admins.indexOf(msg.author.id)>-1) && (!configs.servers[svr.id].chrestrict[ch.id] || configs.servers[svr.id].chrestrict[ch.id].indexOf("poll")==-1)) {
                            if(polls[msg.author.id]) {
                                logMsg(Date.now(), "WARN", null, msg.author.id, "User has already started a poll");
                                bot.sendMessage(msg.channel, "You've already started a poll. Close it before starting a new one.");
                            } else if(!activePolls(ch.id)) {
                                polls[msg.author.id] = {
                                    open: false,
                                    timestamp: Date.now(),
                                    channel: ch.id,
                                    title: "",
                                    options: [],
                                    responderIDs: [],
                                    responses: []
                                };
                                saveData("./data/polls.json", function(err) {
                                    if(err) {
                                        logMsg(Date.now(), "ERROR", "General", null, "Failed to save updated polls data");
                                    }
                                });
                                if(!stats[svr.id].commands.poll) {
                                    stats[svr.id].commands.poll = 0;
                                }
                                stats[svr.id].commands.poll++;
                                logMsg(Date.now(), "INFO", ch.server.id, ch.id, "Poll started by " + msg.author.username);
                                bot.sendMessage(msg.channel, "Enter the poll title or question:");
                            } else {
                                logMsg(Date.now(), "WARN", null, msg.author.id, "Poll already active in " + ch.name + ", " + ch.server.name);
                                bot.sendMessage(msg.channel, "There's already a poll going on in that channel. Try again later.");
                            }
                        } else {
                            bot.sendMessage(msg.channel, "Polls aren't allowed over there. To hell with surveys!");
                        }
                    }
                }
            }
        }
    },
    // Discreetly vote on an active poll
    "vote": {
        usage: "<server> <channel> <no. of choice>",
        process: function(bot, msg, suffix) {
            try {
                var vt = suffix.substring(suffix.lastIndexOf(" ")+1);
                suffix = suffix.substring(0, suffix.lastIndexOf(" "));
                var chnm = suffix.substring(suffix.lastIndexOf(" ")+1);
                suffix = suffix.substring(0, suffix.lastIndexOf(" "));
                var svrnm = suffix;
                var svr = serverSearch(svrnm, msg.author);
                if(!svr) {
                    bot.sendMessage(msg.channel, "I'm not on that server or it doesn't exist");
                    return;
                }
                var ch = channelSearch(chnm, svr);
                if(!ch) {
                    logMsg(Date.now(), "WARN", null, msg.author.id, "Channel does not exist for PM voting");
                    bot.sendMessage(msg.channel, svr.name + " doesn't have that channel. Please try again...");
                    return;
                } else if(stats[svr.id].botOn[ch.id]) {
                    var act = activePolls(ch.id);
                    if(!act) {
                        logMsg(Date.now(), "WARN", null, msg.author.id, "No active poll on provided server/channel for PM voting");
                        bot.sendMessage(msg.channel, "There's no poll going on in that channel. Start one by replying `poll " + svr.name + " " + ch.name + "`");
                        return;
                    }

                    var f = polls[act].responderIDs.indexOf(msg.author.id);
                    if(vt=="." && f>-1) {
                        logMsg(Date.now(), "INFO", svr.id, ch.id, msg.author.username + "'s vote removed");
                        polls[act].responderIDs.splice(f, 1);
                        polls[act].responses.splice(f, 1);
                        bot.sendMessage(msg.channel, "OK, I removed your vote in the poll. You can vote again now.");
                        saveData("./data/polls.json", function(err) {
                            if(err) {
                                logMsg(Date.now(), "ERROR", "General", null, "Failed to save updated polls data");
                            }
                        });
                        return;
                    }
                    if(isNaN(vt)) {
                        vt = polls[act].options.join().toLowerCase().split(",").indexOf(vt.toLowerCase());
                    }
                    if(f>-1 || vt>=polls[act].options.length || vt<0) {
                        logMsg(Date.now(), "WARN", null, msg.author.id, "User provided invalid PM vote for poll in " + svr.name + ", " + ch.name);
                        bot.sendMessage(msg.channel, "I couldn't cast your vote");
                        return;
                    }
                    polls[act].responses.push(vt);
                    polls[act].responderIDs.push(msg.author.id);
                    logMsg(Date.now(), "INFO", svr.id, ch.id, "Vote cast for " + vt + " via PM");
                    bot.sendMessage(msg.channel, "Got it! Your vote was cast anonymously ( ͡° ͜ʖ ͡°)");
                    saveData("./data/polls.json", function(err) {
                        if(err) {
                            logMsg(Date.now(), "ERROR", "General", null, "Failed to save updated polls data");
                        }
                    });
                }
            } catch(error) {
                logMsg(Date.now(), "WARN", null, msg.author.id, "Invalid PM voting syntax provided");
                bot.sendMessage(msg.channel, "Hmmm, I didn't get that. Make sure to use the syntax `vote <server> <channel> <no. of option>`");
            }
        }
    },
    // Get help with the bot
    "help": {
        process: function(bot, msg) {
            bot.sendMessage(msg.author, "Use `@" + bot.user.username + " help` in the public chat to get help, or head over to the wiki: http://wiki.awesomebot.xyz/");
        }
    },
    // Gets OAuth URL
    "join": {
        process: function(bot, msg) {
            bot.sendMessage(msg.author, "https://discordapp.com/oauth2/authorize?&client_id=" + AuthDetails.client_id + "&scope=bot&permissions=0");
        }
    },
    // View recent mentions/tags in a server
    "mentions": {
        usage: "<server>",
        process: function(bot, msg, suffix) {
            if(suffix) {
                var svr = serverSearch(suffix, msg.author);
                if(!svr) {
                    bot.sendMessage(msg.channel, "I'm not on that server. Use `@AwesomeBot join` in the main chat to add me.");
                    return;
                } else if(!svr.members.get("id", msg.author.id)) {
                    logMsg(Date.now(), "WARN", null, msg.author.id, "User is not on " + svr.name + ", so mentions cannot be retreived");
                    bot.sendMessage(msg.channel, "*You're* not on " + svr.name + ". Obviously no one has mentioned you there!");
                    return;
                }

                var info = "";
                if(stats[svr.id].members[msg.author.id].mentions.stream.length>0) {
                    info = "**MENTIONS ON " + svr.name.toUpperCase() + " IN THE LAST WEEK**";
                    for(var i=0; i<stats[svr.id].members[msg.author.id].mentions.stream.length; i++) {
                        var time = prettyDate(new Date(stats[svr.id].members[msg.author.id].mentions.stream[i].timestamp))
                        var tmpinfo = "\n__**@" + stats[svr.id].members[msg.author.id].mentions.stream[i].author + "** at " + time + ":__\n" + stats[svr.id].members[msg.author.id].mentions.stream[i].message + "\n";
                        if((tmpinfo.length + info.length)>1900) {
                            break;
                        } else {
                            info += tmpinfo;
                        }
                    }
                    info += "\n\n";
                    stats[svr.id].members[msg.author.id].mentions.stream = [];
                } else {
                    info = "You haven't been mentioned on " + svr.name + " in the last week. I don't know if that's a good or bad thing...\n";
                }
                logMsg(Date.now(), "INFO", null, msg.author.id, "User checked mentions in " + svr.name);
                info += "*Remember, you can " + (stats[svr.id].members[msg.author.id].mentions.pm ? "disable" : "enable") + " PMs for mentions with `pmmentions " + svr.name + "`*";
                bot.sendMessage(msg.channel, info);
            } else {
                logMsg(Date.now(), "WARN", null, msg.author.id, "User did provide a server for mentions command");
                bot.sendMessage(msg.channel, "Gimme a server pls");
            }
        }
    },
    // Toggles PM mentions in a server
    "pmmentions": {
        usage: "[<server>]",
        process: function(bot, msg, suffix) {
            if(suffix) {
                var svr = serverSearch(suffix, msg.author);
                if(!svr) {
                    bot.sendMessage(msg.channel, "That server isn't available, try a different one.");
                    return;
                }

                stats[svr.id].members[msg.author.id].mentions.pm = !stats[svr.id].members[msg.author.id].mentions.pm;
                if(stats[svr.id].members[msg.author.id].mentions.pm) {
                    bot.sendMessage(msg.channel, "You will now receive PM notifications from me when someone mentions you in " + svr.name + ". Turn them off by replying with `pmmentions " + svr.name + "`");
                } else {
                    bot.sendMessage(msg.channel, "Turned off PMs for mentions in " + svr.name + ". Enable them again by replying with `pmmentions " + svr.name + "`");
                }
                logMsg(Date.now(), "INFO", null, msg.author.id, "Turned " + (stats[svr.id].members[msg.author.id].mentions.pm ? "on" : "off") + " mention PMs in " + svr.name);
            } else {
                var info = "Toggled option to receive PMs for mentions in all servers. Here's your current configuration:";
                for(var i=0; i<bot.servers.length; i++) {
                    if(bot.servers[i].members.get("id", msg.author.id)) {
                        checkStats(msg.author.id, bot.servers[i].id);
                        stats[bot.servers[i].id].members[msg.author.id].mentions.pm = !stats[bot.servers[i].id].members[msg.author.id].mentions.pm;
                        info += "\n\t**" + bot.servers[i].name + ":** " + (stats[bot.servers[i].id].members[msg.author.id].mentions.pm ? "on" : "off");
                    }
                }
                info += "\nReply with `pmmentions` to toggle again.";
                bot.sendMessage(msg.author, info);
                logMsg(Date.now(), "INFO", null, msg.author.id, "Toggled mention PMs in all servers");
            }
            saveData("./data/stats.json", function(err) {
                if(err) {
                    logMsg(Date.now(), "ERROR", "General", null, "Could not save updated PM preferences for " + msg.author.username);
                }
            });
        }
    },
    // Sets an AFK message
    "afk": {
        usage: "<message or \".\">",
        process: function(bot, msg, suffix) {
            if(!suffix) {
                logMsg(Date.now(), "WARN", null, msg.author.id, "User did not provide AFK message");
                bot.sendMessage(msg.author, "What message should I send when you're AFK? Use the syntax `afk <message>`");
            } else if(suffix==".") {
                if(profileData[msg.author.id]) {
                    delete profileData[msg.author.id].AFK;
                    logMsg(Date.now(), "INFO", null, msg.author.id, "Removed AFK message");
                    bot.sendMessage(msg.author, "OK, I won't show that message anymore.");
                } else {
                    logMsg(Date.now(), "WARN", null, msg.author.id, "User tried to delete nonexistent AFK message");
                    bot.sendMessage(msg.author, "I didn't have an AFK message set for you in the first place. Use `afk <message>`");
                }
            } else {
                if(!profileData[msg.author.id]) {
                    profileData[msg.author.id] = {
                        points: 0
                    };
                }
                profileData[msg.author.id].AFK = suffix;
                logMsg(Date.now(), "INFO", null, msg.author.id, "Set AFK message");
                bot.sendMessage(msg.author, "Thanks, I'll show that if/when someone tags you in a server. Reply with `afk .` when you come back :)");
            }
        }
    }
}

// Initializes bot and outputs to console
var bot = new Discord.Client({forceFetchUsers: true});
bot.on("ready", function() {
    checkVersion();

    // Set avatar if necessary
    if(AuthDetails.avatar_url) {
        base64.encode(AuthDetails.avatar_url, {filename: "avatar"}, function(error, image) {
            if(!error) {
                bot.setAvatar(image, function(err) {
                    if(err) {
                        logMsg(Date.now(), "ERROR", "General", null, "Failed to set bot avatar");
                    }
                });
            } else {
                logMsg(Date.now(), "ERROR", "General", null, "Failed to set bot avatar");
            }
        });
    }

    // Set existing reminders
    for(var i=0; i<reminders.length; i++) {
        setReminder(i);
    }

    // Prune old server data sometimes
    if(Math.random()>0.95) {
        pruneServerData();
    }

    // Start message and stat tallies
    if(!stats.timestamp) {
        stats.timestamp = Date.now();
    }
    clearMessageCounter();
    clearLogCounter();
    clearStatCounter();

    // Set playing game if applicable
    if(configs.game && configs.game!="") {
        bot.setStatus("online", configs.game);
    }
    defaultGame(0);

    // Run timer extensions
    domain.run(runTimerExtensions);

    // Start MOTD timer
    domain.run(motdTimer);

    // Start RSS update timer
    domain.run(rssTimer);

    // Start listening for web interface
    try {
        if(disconnects==0 || !openedweb) {
            app.listen(server_port, server_ip_address, function() {
                openedweb = true;
                logMsg(Date.now(), "INFO", "General", null, "Opened web interface on " + server_ip_address + ", server port " + server_port);
            });
        }
    } catch(err) {
        logMsg(Date.now(), "ERROR", "General", null, "Failed to open web interface");
    }

    // Give 50,000 maintainer points :P
    if(configs.maintainer) {
        if(!profileData[configs.maintainer]) {
            profileData[configs.maintainer] = {
                points: 100000
            };
        }
        if(profileData[configs.maintainer].points<100000) {
            profileData[configs.maintainer].points = 100000;
        }
    }

    // Ready to go!
    logMsg(Date.now(), "INFO", "General", null, "Started " + bot.user.username + " v" + version);
});

bot.on("message", function(msg) {
    try {
        messageHandler(msg);
    } catch(msgError) {
        console.log(msgError.stack);
        logMsg(Date.now(), "ERROR", msg.channel.server ? msg.channel.server.id : null, msg.channel.server ? msg.channel.id : msg.author.id, "Something went seriously wrong processing message " + msg.id + ": " + msgError);
    }
});
function messageHandler(msg) {
    // Stop responding if the sender is another bot or botblocked
    if(configs.botblocked.indexOf(msg.author.id)>-1 || msg.author.bot || msg.author.id==bot.user.id || !openedweb) {
        return;
    }

    // Stuff that only applies to PMs
    if(msg.channel.isPrivate) {
        // Update command from maintainer
        if(updateconsole && msg.author.id==configs.maintainer && msg.content=="update") {
            updateBot(msg);
        }

        if(msg.author.id!=configs.maintainer && configs.pmforward) {
            bot.sendMessage(bot.users.get("id", configs.maintainer), "**@" + msg.author.username + "** just sent me this PM:```" + msg.cleanContent + "```");
        }

        // Gets poll title from user and asks for poll options
        if(polls[msg.author.id] && polls[msg.author.id].title=="") {
            polls[msg.author.id].title = msg.content;
            saveData("./data/polls.json", function(err) {
                if(err) {
                    logMsg(Date.now(), "ERROR", "General", null, "Failed to save updated polls data");
                }
            });
            bot.sendMessage(msg.channel, "Enter poll options, separated by commas, or `.` for yes/no:");
            return;
        // Gets poll options from user and starts voting
        } else if(polls[msg.author.id] && polls[msg.author.id].options.length==0) {
            if(msg.content==".") {
                polls[msg.author.id].options = ["No", "Yes"];
            } else {
                var optionsProvided = msg.content.split(",");
                for(var i=0; i<optionsProvided.length; i++) {
                    if(optionsProvided[i] && optionsProvided.lastIndexOf(optionsProvided[i])==i) {
                        polls[msg.author.id].options.push(optionsProvided[i]);
                    }
                }
                if(polls[msg.author.id].options.length==0) {
                    polls[msg.author.id].options.push(msg.content);
                }
            }
            bot.sendMessage(msg.channel, "OK, got it. You can end the poll by sending me `poll close`.");
            polls[msg.author.id].open = true;
            saveData("./data/polls.json", function(err) {
                if(err) {
                    logMsg(Date.now(), "ERROR", "General", null, "Failed to save updated polls data");
                }
            });

            var ch = bot.channels.get("id", polls[msg.author.id].channel);
            var info = msg.author + " has started a new poll: **" + polls[msg.author.id].title + "**";
            for(var i=0; i<polls[msg.author.id].options.length; i++) {
                info += "\n\t" + i + ": " + polls[msg.author.id].options[i];
            }
            info += "\nYou can vote by typing `" + getPrefix(ch.server) + "vote <no. of choice>`. If you don't include a number, I'll just show results";
            bot.sendMessage(ch, info);
            return;
        }

        // Check if message is a PM command
        var cmdTxt = msg.content.toLowerCase();
        var prefixOptions = ["@" + bot.user.username.toLowerCase() + " ", "+", "&", "!", "-", "--", "/", "$", ">", "`", "~", "*", "=", "\\", "'"];
        for(var i=0; i<prefixOptions.length; i++) {
            if(cmdTxt.indexOf(prefixOptions[i])==0) {
                cmdTxt = cmdTxt.slice(prefixOptions[i].length);
            }
        }
        var suffix;
        if(cmdTxt.indexOf(" ")>-1) {
            suffix = cmdTxt.substring(cmdTxt.indexOf(" ")+1).trim();
            cmdTxt = cmdTxt.substring(0, cmdTxt.indexOf(" ")).toLowerCase();
        }
        var cmd = pmcommands[cmdTxt];
        if(cmd) {
            if(cmdTxt!="config" || suffix) {
                logMsg(Date.now(), "INFO", null, msg.author.id, "Treating '" + msg.cleanContent + "' as a PM command");
            }
            try {
                cmd.process(bot, msg, suffix);
            } catch(cmdError) {
                console.log(cmdError.stack);
                logMsg(Date.now(), "ERROR", null, msg.author.id, "Something went seriously wrong processing command '" + msg.cleanContent + "': " + cmdError);
                bot.sendMessage(msg.channel, "Something went wrong :scream:");
            }
            return;
        }
    }

    // Stuff that only applies to public messages
    if(!msg.channel.isPrivate) {
        // Ready server stats and configs
        if(!readiedServers[msg.channel.server.id]) {
            readyServer(msg.channel.server);
        }

        // Count new message
        messages[msg.channel.server.id]++;
        if(configs.servers[msg.channel.server.id].statsexclude.indexOf(msg.channel.id)==-1) {
            checkStats(msg.author.id, msg.channel.server.id);
            stats[msg.channel.server.id].members[msg.author.id].messages++;
            checkRank(msg.author, msg.channel.server);
            stats[msg.channel.server.id].members[msg.author.id].active = Date.now();
        }

        // Reset timer for room if applicable
        if(rooms[msg.channel.id]) {
            clearTimeout(rooms[msg.channel.id]);
            rooms[msg.channel.id] = setTimeout(function() {
                bot.deleteChannel(msg.channel, function(err) {
                    if(!err) {
                        delete rooms[msg.channel.id];
                        delete stats[msg.channel.server.id].botOn[msg.channel.id];
                        logMsg(Date.now(), "INFO", msg.channel.server.id, null, "Auto-deleted room " + msg.channel.name);
                    } else {
                        logMsg(Date.now(), "INFO", msg.channel.server.id, null, "Failed to auto-delete room " + msg.channel.name);
                    }
                });
            }, 300000);
        }

        // Check for message from AFK user
        if(profileData[msg.author.id] && profileData[msg.author.id].AFK) {
            delete profileData[msg.author.id].AFK;
            logMsg(Date.now(), "INFO", null, msg.author.id, "Auto-removed AFK message");
        }

        // If start statement is issued, say hello and begin listening
        var startcmd = checkCommandTag(msg.content, msg.channel.server.id);
        if(startcmd && startcmd[0].toLowerCase()=="start" && (configs.servers[msg.channel.server.id].admincommands.indexOf("quiet")==-1 || configs.servers[msg.channel.server.id].admins.indexOf(msg.author.id)>-1) && !stats[msg.channel.server.id].botOn[msg.channel.id]) {
            var suffix = startcmd[1];
            var timestr = "";
            if(suffix.toLowerCase()=="all") {
                timestr = " in all channels";
                for(var chid in stats[msg.channel.server.id].botOn) {
                    stats[msg.channel.server.id].botOn[chid] = true;
                }
            } else {
                stats[msg.channel.server.id].botOn[msg.channel.id] = true;
            }
            logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Bot has been started by an admin" + timestr);
            bot.sendMessage(msg.channel, "Hello!");
            return;
        }

        // Check if the bot is off and stop responding
        if(!stats[msg.channel.server.id].botOn[msg.channel.id]) {
            return;
        }

        // Check if using a filtered word
        if(checkFiltered(msg, false, true) && configs.servers[msg.channel.server.id].admins.indexOf(msg.author.id)==-1 && configs.servers[msg.channel.server.id].servermod) {
            handleFiltered(msg, "filtered");
        }

        // Check for spam
        if(configs.servers[msg.channel.server.id].admins.indexOf(msg.author.id)==-1 && configs.servers[msg.channel.server.id].servermod && configs.servers[msg.channel.server.id].spamfilter[0] && configs.servers[msg.channel.server.id].spamfilter[1].indexOf(msg.channel.id)==-1) {
            // Tracks spam for a user with each new message, expires after 45 seconds
            if(!spams[msg.channel.server.id][msg.author.id]) {
                spams[msg.channel.server.id][msg.author.id] = [];
                spams[msg.channel.server.id][msg.author.id].push(msg.content);
                setTimeout(function() {
                    try {
                        delete spams[msg.channel.server.id][msg.author.id];
                    } catch(err) {
                        ;
                    }
                }, 45000);
            // Add a message to the user's spam list if it is similar to the last one
            } else if(levenshtein.get(spams[msg.channel.server.id][msg.author.id][spams[msg.channel.server.id][msg.author.id].length-1], msg.content)<3) {
                logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Adding message from " + msg.author.username + " to their spam list");
                spams[msg.channel.server.id][msg.author.id].push(msg.content);

                // Minus AwesomePoints!
                if(!profileData[msg.author.id]) {
                    profileData[msg.author.id] = {
                        points: 0
                    }
                }
                var negative;

                // First-time spam warning
                if(spams[msg.channel.server.id][msg.author.id].length==configs.servers[msg.channel.server.id].spamfilter[2]) {
                    logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Handling first-time spam from " + msg.author.username);
                    bot.sendMessage(msg.author, "Stop spamming " + msg.channel.server.name + ". The chat mods have been notified about this.");
                    adminMsg(false, msg.channel.server, msg.author, " is spamming #" + msg.channel.name + " in " + msg.channel.server.name);
                    negative = 20;
                // Second-time spam warning, bans user from using bot
                } else if(spams[msg.channel.server.id][msg.author.id].length==configs.servers[msg.channel.server.id].spamfilter[2]*2) {
                    logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Handling second-time spam from " + msg.author.username);
                    var role = configs.servers[msg.channel.server.id].spamfilter[4] ? msg.channel.server.roles.get("id", configs.servers[msg.channel.server.id].spamfilter[4]) : null;
                    if(role) {
                        bot.addMemberToRole(msg.author, role, function(err) {
                            if(err) {
                                logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to add " + msg.author.username + " to role " + role.name + " after spam");
                            } else {
                                logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Added " + msg.author.username + " to role " + role.name + " after spam");
                            }
                        });
                    }
                    if(configs.servers[msg.channel.server.id].spamfilter[5]) {
                        bot.getChannelLogs(msg.channel, configs.servers[msg.channel.server.id].spamfilter[2]*2, function(err, messages) {
                            if(err) {
                                logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to delete spam from " + msg.author.username);
                            } else {
                                for(var i=0; i<messages.length; i++) {
                                    if(messages.author.id!=msg.author.id) {
                                        messages.splice(i, 1);
                                    }
                                }
                                bot.deleteMessages(messages, function(err) {
                                    if(err) {
                                        logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to delete spam from " + msg.author.username);
                                    } else {
                                        logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Deleted spam from " + msg.author.username);
                                    }
                                });
                            }
                        });
                    }
                    handleViolation(msg, "continues to spam", "spamming", configs.servers[msg.channel.server.id].spamfilter[3]);
                    negative = 50;
                }

                if(negative!=null) {
                    if(configs.servers[msg.channel.server.id].points) {
                        profileData[msg.author.id].points -= negative;
                    }
                    checkStats(msg.author.id, msg.channel.server.id);
                    stats[msg.channel.server.id].members[msg.author.id].strikes.push(["Automatic", (negative>20 ? "Second" : "First") + "-time spam violation", Date.now()]);
                }
            }
        }

        // Stop responding if the author is a blocked user
        if(configs.servers[msg.channel.server.id].blocked.indexOf(msg.author.id)>-1) {
            return;
        }

        // Translate message from certain users
        if(configs.servers[msg.channel.server.id].translated.list.indexOf(msg.author.id)>-1 && configs.servers[msg.channel.server.id].translated.channels[configs.servers[msg.channel.server.id].translated.list.indexOf(msg.author.id)].indexOf(msg.channel.id)>-1) {
            bingTranslate.translate(msg.cleanContent, configs.servers[msg.channel.server.id].translated.langs[configs.servers[msg.channel.server.id].translated.list.indexOf(msg.author.id)], "EN", function(err, result) {
                if(err) {
                    logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to auto-translate '" + msg.cleanContent + "' from " + msg.author.username);
                } else {
                    bot.sendMessage(msg.channel, "**@" + getName(msg.channel.server, msg.author) + "** said:```" + result.translated_text + "```");
                }
            });
        }

        // Check if message includes a tag or attempted tag
        var tagstring = msg.content.slice(0);
        while(tagstring.length>0 && tagstring.indexOf("@")>-1 && tagstring.substring(tagstring.indexOf("@")+1)) {
            var usr;
            tagstring = tagstring.substring(tagstring.indexOf("@")+1);
            if(tagstring.charAt(0)=='!') {
                tagstring = tagstring.substring(1);
            }
            if(tagstring.indexOf(">")) {
                var usrid = tagstring.substring(0, tagstring.indexOf(">"));
                tagstring = tagstring.substring(tagstring.indexOf(">")+1);
                usr = msg.channel.server.members.get("id", usrid);
            } else {
                var usrnm = tagstring.slice(0);
                usr = msg.channel.server.members.get("username", usrnm);
                while(!usr && usrnm.length>0) {
                    usrnm = usrnm.substring(0, usrnm.lastIndexOf(" "));
                    usr = msg.channel.server.members.get("username", usrnm);
                }
                tagstring = tagstring.substring(usrnm.length);
            }
            if(usr && !usr.bot) {
                var mentions = stats[msg.channel.server.id].members[usr.id].mentions;
                mentions.stream.push({
                    timestamp: Date.now(),
                    author: removeMd(msg.author.username),
                    message: msg.cleanContent
                });
                if(mentions.pm && usr.status!="online") {
                    bot.sendMessage(usr, "__You were mentioned by @" + msg.author.username + " on **" + msg.channel.server.name + "**:__\n" + msg.cleanContent);
                }
                if(((profileData[usr.id] && profileData[usr.id].AFK) || stats[msg.channel.server.id].members[usr.id] && stats[msg.channel.server.id].members[usr.id].AFK) && configs.servers[msg.channel.server.id].afk) {
                    bot.sendMessage(msg.channel, "**@" + getName(msg.channel.server, usr) + "** is currently AFK: " + (stats[msg.channel.server.id].members[usr.id].AFK || profileData[usr.id].AFK));
                }

                if([msg.author.id, bot.user.id].indexOf(usr.id)==-1 && configs.servers[msg.channel.server.id].points && !novoting[msg.author.id] && msg.channel.server.members.length>2) {
                    var votestrings = [" +!", " +1", " up", " ^", " thx", " ty", " thanks", " thank you", " god bless"];
                    var voted;
                    for(var i=0; i<votestrings.length; i++) {
                        if(tagstring.indexOf(votestrings[i])==0) {
                            voted = "upvoted";
                            if(!profileData[usr.id]) {
                                profileData[usr.id] = {
                                    points: 0
                                };
                            }
                            profileData[usr.id].points++;
                            break;
                        }
                    }
                    if(tagstring.indexOf(" gild")==0) {
                        if(!profileData[msg.author.id]) {
                            profileData[msg.author.id] = {
                                points: 0
                            }
                        }
                        if(profileData[msg.author.id].points<10) {
                            logMsg(Date.now(), "WARN", msg.channel.server.id, msg.channel.id, msg.author.username + " does not have enough points to gild " + usr.username);
                            bot.sendMessage(msg.channel, msg.author + " You don't have enough AwesomePoints to gild " + usr);
                            return;
                        }
                        voted = "gilded";
                        profileData[msg.author.id].points -= 10;
                        if(!profileData[usr.id]) {
                            profileData[usr.id] = {
                                points: 0
                            };
                        }
                        profileData[usr.id].points += 10;
                    }

                    if(voted) {
                        logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, usr.username + " " + voted + " by " + msg.author.username);
                        novoting[msg.author.id] = true;
                        setTimeout(function() {
                            delete novoting[msg.author.id];
                        }, 3000);
                        stats[msg.channel.server.id].members[msg.author.id].messages--;
                        return;
                    }
                }
            }
        }
        // Upvote previous message, based on context
        if((msg.content.indexOf("+1")==0 || msg.content.indexOf("+!")==0 || msg.content.indexOf("^")==0 || msg.content.indexOf("up")==0 || msg.content.indexOf("thx")==0 || msg.content.indexOf("ty")==0 || msg.content.indexOf("thanks")==0 || msg.content.indexOf("thank you")==0 || msg.content.indexOf("god bless")==0) && configs.servers[msg.channel.server.id].points && !novoting[msg.author.id] && msg.channel.server.members.length>2) {
            bot.getChannelLogs(msg.channel, 1, {before: msg}, function(err, messages) {
                if(!err && messages[0]) {
                    if([msg.author.id, bot.user.id].indexOf(messages[0].author.id)==-1) {
                        if(!profileData[messages[0].author.id]) {
                            profileData[messages[0].author.id] = {
                                points: 0
                            };
                        }
                        profileData[messages[0].author.id].points++;
                        logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, messages[0].author.username + " upvoted by " + msg.author.username);
                        stats[msg.channel.server.id].members[msg.author.id].messages--;
                    }
                }
            });
        }

        // Stop if cooldown is applied
        if(cooldowns[msg.channel.id]) {
            return;
        }

        // Check for active select menu
        if(selectmenu[msg.channel.id] && msg.author.id==selectmenu[msg.channel.id].usrid) {
            if(msg.content.toLowerCase()=="quit") {
                delete selectmenu[msg.channel.id];
            } else if(!isNaN(msg.content.trim()) && parseInt(msg.content.trim())>=0 && parseInt(msg.content.trim())<=selectmenu[msg.channel.id].max) {
                selectmenu[msg.channel.id].process(parseInt(msg.content.trim()));
                delete selectmenu[msg.channel.id];
            } else {
                bot.sendMessage(msg.channel, "Invalid selection. Type a number from 0 to " + selectmenu[msg.channel.id].max + " or `quit`.");
            }
            return;
        }

        // Apply extensions for this server
        for(var ext in configs.servers[msg.channel.server.id].extensions) {
            var extension = configs.servers[msg.channel.server.id].extensions[ext];
            if((extension.channels && extension.channels.length>0 && extension.channels.indexOf(msg.channel.id)==-1) || extension.type=="timer") {
                continue;
            }

            var keywordcontains = contains(extension.key, msg.content, extension.case);
            if((extension.type.toLowerCase()=="keyword" && keywordcontains>-1) || (extension.type.toLowerCase()=="command" && checkCommandTag(msg.content, msg.channel.server.id) && checkCommandTag(msg.content, msg.channel.server.id)[0].toLowerCase()==extension.key.toLowerCase())) {
                logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Treating '" + msg.cleanContent + "' from " + msg.author.username + " as an extension " + configs.servers[msg.channel.server.id].extensions[ext].type);
                if(extension.type=="command") {
                    if(!stats[msg.channel.server.id].commands[extension.key]) {
                        stats[msg.channel.server.id].commands[extension.key] = 0;
                    }
                    stats[msg.channel.server.id].commands[extension.key]++;
                }

                var params = getExtensionParams(configs.servers[msg.channel.server.id].extensions[ext], msg.channel.server, msg.channel, msg, extension.type.toLowerCase()=="keyword" ? keywordcontains : null, extension.type.toLowerCase()=="command" ? checkCommandTag(msg.content, msg.channel.server.id)[1] : null);
                try {
                    var extDomain = domainRoot.create();
                    extDomain.run(function() {
                        var context = new vm.createContext(params);
                        var script = new vm.Script(configs.servers[msg.channel.server.id].extensions[ext].process.replaceAll("<!--AWESOME_EXTENSION_NEWLINE-->", ""));
                        script.runInContext(context, {
                            displayErrors: true,
                            timeout: 10000
                        });
                    });
                    extDomain.on("error", function(runError) {
                        logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to run extension " + configs.servers[msg.channel.server.id].extensions[ext].type + ": " + runError);
                    });
                } catch(runError) {
                    logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to run extension " + configs.servers[msg.channel.server.id].extensions[ext].type + ": " + runError);
                }
                setCooldown(msg.channel);
                return;
            }
        }
    }

    // Check if message is a command (bot tagged and matches commands list)
    var cmd;
    if(!msg.channel.isPrivate && checkCommandTag(msg.content, msg.channel.server.id)) {
        var cmdTxt = checkCommandTag(msg.content, msg.channel.server.id)[0].toLowerCase();
        var suffix = checkCommandTag(msg.content, msg.channel.server.id)[1].trim();
        cmd = commands[cmdTxt];
    }

    // Process commands
    if(cmd && !msg.channel.isPrivate && stats[msg.channel.server.id].botOn[msg.channel.id]) {
        if(configs.servers[msg.channel.server.id][cmdTxt]!=null) {
            if(configs.servers[msg.channel.server.id][cmdTxt]==false) {
                return;
            }
        }
        if((configs.servers[msg.channel.server.id].admincommands.indexOf(cmdTxt)>-1 && configs.servers[msg.channel.server.id].admins.indexOf(msg.author.id)==-1) || (configs.servers[msg.channel.server.id].chrestrict[msg.channel.id] && configs.servers[msg.channel.server.id].chrestrict[msg.channel.id].indexOf(cmdTxt)>-1)) {
            return;
        }
        if(checkFiltered(msg, true, false) && configs.servers[msg.channel.server.id].admins.indexOf(msg.author.id)==-1 && configs.servers[msg.channel.server.id].servermod && configs.servers[msg.channel.server.id].nsfwfilter[0] && configs.servers[msg.channel.server.id].nsfwfilter[1].indexOf(msg.channel.id)==-1 && ["image", "youtube", "gif", "search"].indexOf(cmdTxt)>-1) {
            handleFiltered(msg, "NSFW");
        } else if(stats[msg.channel.server.id].botOn[msg.channel.id]) {
            logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Treating '" + msg.cleanContent + "' from " + msg.author.username + " as a command");
            if(["quiet", "ping", "help", "stats", "trivia", "vote"].indexOf(cmdTxt)==-1) {
                if(!stats[msg.channel.server.id].commands[cmdTxt]) {
                    stats[msg.channel.server.id].commands[cmdTxt] = 0;
                }
                stats[msg.channel.server.id].commands[cmdTxt]++;
            }
            if(configs.servers[msg.channel.server.id].deletecommands && msg.channel.permissionsOf(bot.user).hasPermission("manageMessages")) {
                nodeletemembermsg[msg.channel.id] = true;
                bot.deleteMessage(msg, function() {
                    delete nodeletemembermsg[msg.channel.id];
                });
            }
            try {
                cmd.process(bot, msg, suffix);
            } catch(cmdError) {
                console.log(cmdError.stack);
                logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Something went seriously wrong processing command '" + msg.cleanContent + "': " + cmdError);
                bot.sendMessage(msg.channel, "Something went wrong :scream:");
            }
        }
        setCooldown(msg.channel);
    // Check for matching tag commands
    } else if(!msg.channel.isPrivate && !suffix && configs.servers[msg.channel.server.id].tags[cmdTxt] && configs.servers[msg.channel.server.id].tagcommands.indexOf(cmdTxt)>-1) {
        logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Treating '" + msg.cleanContent + "' from " + msg.author.username + " as a tag command");
        bot.sendMessage(msg.channel, configs.servers[msg.channel.server.id].tags[cmdTxt]);
        setCooldown(msg.channel);
    // Process message as chatterbot prompt if not a command
    } else if((msg.content.indexOf(bot.user.mention())==0 || msg.content.indexOf("<@!" + bot.user.id + ">")==0 || msg.channel.isPrivate) && !msg.author.bot) {
        if(!msg.channel.isPrivate) {
            if(!configs.servers[msg.channel.server.id].chatterbot || (configs.servers[msg.channel.server.id].admincommands.indexOf("chatterbot")>-1 && configs.servers[msg.channel.server.id].admins.indexOf(msg.author.id)==-1) || (configs.servers[msg.channel.server.id].chrestrict[msg.channel.id] && configs.servers[msg.channel.server.id].chrestrict[msg.channel.id].indexOf("chatterbot")>-1)) {
                return;
            }
            logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Treating '" + msg.cleanContent + "' from " + msg.author.username + " as a chatterbot prompt");
        } else {
            logMsg(Date.now(), "INFO", null, msg.author.id, "Treating '" + msg.content + "' as chatterbot prompt");
        }
        var prompt = "";
        if(!msg.channel.isPrivate) {
            prompt = msg.cleanContent.substring((msg.channel.server.detailsOfUser(bot.user).nick || bot.user.username).length+1);
            prompt = prompt.substring(prompt.indexOf(" ")+1);
            setCooldown(msg.channel);
            if(prompt.toLowerCase().indexOf("help")==0) {
                bot.sendMessage(msg.channel, "Use `" + getPrefix(msg.channel.server) + "help` for info about how to use me on this server :smiley:");
                return;
            }
            if(prompt.toLowerCase().indexOf("join")==0) {
                bot.sendMessage(msg.channel, "https://discordapp.com/oauth2/authorize?&client_id=" + AuthDetails.client_id + "&scope=bot&permissions=0");
                return;
            }
        } else {
            prompt = msg.cleanContent;
        }

        bot.startTyping(msg.channel, function() {
            unirest.get("http://api.program-o.com/v2/chatbot/?bot_id=6&say=" + encodeURI(prompt.replace(/&/g, '')) + "&convo_id=" + msg.author.id + "&format=json")
            .headers({
                "Accept": "application/json",
                "User-Agent": "Unirest Node.js"
            })
            .end(function(response) {
                var res = "I don't feel like talking rn >:(";
                if(response.status==200) {
                    try {
                        res = JSON.parse(response.body).botsay.replaceAll("Program-O", bot.user.username).replaceAll("<br/>", "\n");
                    } catch(err) {
                        res = "I don't feel like talking rn >:(";
                    }
                }
                if(!msg.channel.isPrivate) {
                    res = msg.author + " " + res;
                }
                bot.sendMessage(msg.channel, res, function() {
                    bot.stopTyping(msg.channel);
                });
            });
        });
    // Otherwise, check if it's a self-message or just does the tag reaction
    } else {
        if(msg.author!=bot.user && msg.isMentioned(bot.user) && configs.servers[msg.channel.server.id].tagreaction && (configs.servers[msg.channel.server.id].admincommands.indexOf("tagreaction")==-1 || configs.servers[msg.channel.server.id].admins.indexOf(msg.author.id)>-1) && (!configs.servers[msg.channel.server.id].chrestrict[msg.channel.id] || configs.servers[msg.channel.server.id].chrestrict[msg.channel.id].indexOf("tagreaction")==-1)) {
            logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Bot tagged by " + msg.author.username);
            bot.sendMessage(msg.channel,msg.author + ", you called?");
        }
    }
}

// Set a cooldown for the next command if necessary
function setCooldown(ch) {
    if(stats[ch.server.id].cools[ch.id] || configs.servers[ch.server.id].cooldown>0) {
        cooldowns[ch.id] = true;
        setTimeout(function() {
            delete cooldowns[ch.id];
        }, stats[ch.server.id].cools[ch.id] || configs.servers[ch.server.id].cooldown);
    }
}

// Add server if joined outside of bot
bot.on("serverCreated", function(svr) {
    readyServer(svr);
});

function readyServer(svr) {
    readiedServers[svr.id] = true;

    // Configure new server
    if(!configs.servers[svr.id]) {
        newServer(svr);
    }

    // Make sure config.json is up-to-date
    checkConfig(svr);

    // Populate stats file
    populateStats(svr);

    // Set runtime values
    messages[svr.id] = 0;
    spams[svr.id] = {};
    filterviolations[svr.id] = {};

    // Restart countdowns
    for(var event in configs.servers[svr.id].countdowns) {
        setTimeout(function() {
            var ch = svr.channels.get("id", configs.servers[svr.id].countdowns[event].chid);
            if(ch) {
                bot.sendMessage(ch, "3...2...1...**" + configs.servers[svr.id].countdowns[event].name + "**");
                delete configs.servers[svr.id].countdowns[event];
                logMsg(Date.now(), "INFO", svr.id, ch.id, "Countdown " + event + " expired");
            }
        }, configs.servers[svr.id].countdowns[event].timestamp - Date.now());
    }
}

function newServer(svr) {
    logMsg(Date.now(), "INFO", "General", null, "Server " + svr.name + " joined");
    defaultConfig(svr);
    adminMsg(false, svr, {username: bot.user.username}, " (me) has been added to " + svr.name + ". You're one of my admins. You can manage me in this server by PMing me `config " + svr.name + "`. Check out http://awesomebot.xyz/ to learn more.");
    bot.sendMessage(svr.defaultChannel, "Hi, I'm " + (svr.detailsOfUser(bot.user).nick || bot.user.username) + "! Use `" + getPrefix(svr) + "help` to learn more or check out http://awesomebot.xyz/");
    postData();
}

function postData() {
    // Authorize AwesomeBot
    unirest.post("http://awesome.awesomebot.xyz/botauth?token=" + AuthDetails.awesome_token)
    .end(function(response) {
        if(response.status==200) {
            postCarbon();
            unirest.post("http://awesome.awesomebot.xyz/botdata?token=" + AuthDetails.awesome_token + "&svrcount=" + bot.servers.length + "&usrcount=" + bot.users.length)
            .end(function(response) {
                if(response.status==200) {
                    logMsg(Date.now(), "INFO", "General", null, "Successfully POSTed to Awesome");
                }
            });
        } else if(response.status==401) {
            logMsg(Date.now(), "ERROR", "General", null, "Unauthorized AwesomeBot running, exiting. Please see https://github.com/BitQuote/AwesomeBot/wiki/Setup#getting-started");
            process.exit();
        }
    });
}

function postCarbon() {
    if(AuthDetails.carbon_key) {
        unirest.post("https://www.carbonitex.net/discord/data/botdata.php")
        .headers({
            "Accept": "application/json",
            "Content-Type": "application/json"
        }).send({
            "key": AuthDetails.carbon_key,
            "servercount": bot.servers.length
        }).end(function(response) {
            if(response.status==200) {
                logMsg(Date.now(), "INFO", "General", null, "Successfully POSTed to Carbonitex");
            }
        });
    }
}

// Turn bot on in a new channel
bot.on("channelCreated", function(ch) {
    if(!ch.isPrivate) {
        if(!readiedServers[ch.server.id]) {
            readyServer(ch.server);
        }
        stats[ch.server.id].botOn[ch.id] = true;
        logMsg(Date.now(), "INFO", ch.server.id, null, "New channel created: " + ch.name);
        saveData("./data/stats.json", function(err) {
            if(err) {
                logMsg(Date.now(), "ERROR", "General", null, "Could not save updated stats for " + ch.server.name);
            }
        });
    }
});

// Leave server if deleted
bot.on("serverDeleted", function(svr) {
    domain.run(function() {
        deleteServerData(svr.id);
    });
    logMsg(Date.now(), "INFO", "General", null, "Server " + svr.name + " removed, left server");
    postData();
});

// Checks for old servers
function pruneServerData() {
    for(var svrid in configs.servers) {
        var svr = bot.servers.get("id", svrid);
        if(!svr) {
            deleteServerData(svrid);
        } else {
            for(var usrid in stats[svrid].members) {
                if(!svr.members.get("id", usrid)) {
                    delete stats[svrid].members[usrid];
                }
            }
        }
    }
    for(var svrid in stats) {
        if(!bot.servers.get("id", svrid) && svrid!="timestamp") {
            deleteServerData(svrid);
        }
    }
}

// Delete everything for a server
function deleteServerData(svrid) {
    delete configs.servers[svrid];
    delete messages[svrid];
    delete spams[svrid];
    delete filterviolations[svrid];
    delete stats[svrid];
    delete readiedServers[svrid];
}

// New server member handling
bot.on("serverMemberUpdated", function(svr, usr) {
    if(!readiedServers[svr.id]) {
        readyServer(svr);
    }
    var rolesOfMember = svr.rolesOfUser(usr);
    if(rolesOfMember) {
        for(var i=0; i<rolesOfMember.length; i++) {
            if(rolesOfMember[i] && typeof(rolesOfMember[i].hasPermission)=="function" && rolesOfMember[i].hasPermission("banMembers") && configs.servers[svr.id].admins.indexOf(usr.id)==-1 && configs.servers[svr.id].blocked.indexOf(usr.id)==-1 && configs.botblocked.indexOf(usr.id)==-1 && usr.id!=bot.user.id && !usr.bot) {
                configs.servers[svr.id].admins.push(usr.id);
                logMsg(Date.now(), "INFO", svr.id, null, "Auto-added " + usr.username + " to admins list");
            } else if(!rolesOfMember[i].hasPermission("banMembers") && configs.servers[svr.id].admins.indexOf(usr.id)>-1 && [configs.maintainer, svr.owner.id, bot.user.id].indexOf(usr.id)==-1 && !usr.bot) {
                configs.servers[svr.id].admins.splice(configs.servers[svr.id].admins.indexOf(usr.id), 1);
                logMsg(Date.now(), "INFO", svr.id, null, "Auto-removed " + usr.username + " from admins list");
            }
        }
    }
});

bot.on("serverNewMember", function(svr, usr) {
    if(!readiedServers[svr.id]) {
        readyServer(svr);
    }

    // Check if this has been enabled in admin console and the bot is listening
    if(configs.servers[svr.id].servermod) {
        if(configs.servers[svr.id].newmembermsg[0]) {
            logMsg(Date.now(), "INFO", svr.id, null, "New member: " + usr.username);
            var ch = svr.channels.get("id", configs.servers[svr.id].newmembermsg[2]);
            if(ch && stats[svr.id].botOn[ch.id]) {
                bot.sendMessage(ch, configs.servers[svr.id].newmembermsg[1][getRandomInt(0, configs.servers[svr.id].newmembermsg[1].length-1)].replaceAll("++", usr));
            }
        }
        if(configs.servers[svr.id].newmemberpm && !usr.bot) {
            bot.sendMessage(usr, "Welcome to the " + svr.name + " Discord chat! " + configs.servers[svr.id].newgreeting + " I'm " + (svr.detailsOfUser(bot.user).nick || bot.user.username) + " by the way. Learn more with `" + getPrefix(svr) + "help` in the public chat.");
        }
    }
    if(configs.servers[svr.id].servermod && configs.servers[svr.id].newrole.length>0) {
        for(var i=0; i<configs.servers[svr.id].newrole.length; i++) {
            var role = svr.roles.get("id", configs.servers[svr.id].newrole[i]);
            if(role) {
                bot.addMemberToRole(usr, role, function(err) {
                    if(err) {
                        logMsg(Date.now(), "ERROR", svr.id, null, "Failed to add new member " + usr.username + " to default role " + role.name);
                    }
                });
            }
        }
    }

    if(!usr.bot) {
        checkStats(usr.id, svr.id);
        if(usr.id==configs.maintainer && configs.servers[svr.id].admins.indexOf(configs.maintainer)==-1) {
            configs.servers[svr.id].admins.push(configs.maintainer);
        }
    }
});

// Updates voice counter when user joins voice channel
bot.on("voiceJoin", function(ch, usr) {
    if(openedweb && !usr.bot && (!ch.server.afkChannel || (ch.server.afkChannel && ch.id!=ch.server.afkChannel.id))) {
        if(!readiedServers[ch.server.id]) {
            readyServer(ch.server);
        }
        if(!voice[usr.id]) {
            checkStats(usr.id, ch.server.id);
            voice[usr.id] = Date.now();
            stats[ch.server.id].members[usr.id].active = Date.now();
        }
        if(configs.servers[ch.server.id].voicetext.indexOf(ch.id)>-1) {
            var addToVoicetext = function(channel) {
                bot.overwritePermissions(channel, usr, {
                    "readMessages": true,
                    "sendMessages": true
                }, function(err) {
                    if(err) {
                        logMsg(Date.now(), "ERROR", ch.server.id, null, "Failed to add " + msg.author.username + " to voicetext channel " + channel.name);
                    }
                });
            };
            var channel = ch.server.channels.get("name", ch.name.replaceAll(" ", "").toLowerCase() + "-voicetext");
            if(!channel) {
                bot.createChannel(ch.server, ch.name.replaceAll(" ", "").toLowerCase() + "-voicetext", function(err, channel) {
                    bot.overwritePermissions(channel, ch.server.roles.get("name", "@everyone"), {
                        "readMessages": false,
                        "sendMessages": false,
                    }, function(err) {
                        if(err) {
                            logMsg(Date.now(), "ERROR", ch.server.id, null, "Failed to create voicetext channel for " + ch.name);
                        } else {
                            addToVoicetext(channel);
                        }
                    });
                });
            } else {
                addToVoicetext(channel);
            }
            
        }
    }
});

// Updates user stats when user deafens
bot.on("voiceStateUpdate", function(ch, usr, oldprops, newprops) {
    if(openedweb && !usr.bot && (!ch.server.afkChannel || ch.id!=ch.server.afkChannel.id)) {
        if(!readiedServers[ch.server.id]) {
            readyServer(ch.server);
        }

        checkStats(usr.id, ch.server.id);
        if(((oldprops.deaf==false && newprops.deaf==true) || (oldprops.selfDeaf==false && newprops.selfDeaf==true)) && voice[usr.id]) {
            stats[ch.server.id].members[usr.id].voice += (((Date.now() - voice[usr.id])/1000)/60) * 0.02;
            delete voice[usr.id];
            checkRank(usr, ch.server);
        } else if(((oldprops.deaf==true && newprops.deaf==false) || (oldprops.selfDeaf==true && newprops.selfDeaf==false)) && !voice[usr.id]) {
            voice[usr.id] = Date.now();
            stats[ch.server.id].members[usr.id].active = Date.now();
        }
    }
});

// Updates user stats when user leaves voice channel
bot.on("voiceLeave", function(ch, usr) {
    if(openedweb && !usr.bot && (!ch.server.afkChannel || ch.id!=ch.server.afkChannel.id)) {
        if(!readiedServers[ch.server.id]) {
            readyServer(ch.server);
        }
        if(voice[usr.id]) {
            checkStats(usr.id, ch.server.id);
            stats[ch.server.id].members[usr.id].voice += (((Date.now() - voice[usr.id])/1000)/60) * 0.02;
            delete voice[usr.id];
            checkRank(usr, ch.server);
        }
        if(configs.servers[ch.server.id].voicetext.indexOf(ch.id)>-1) {
            var channel = ch.server.channels.get("name", ch.name.replaceAll(" ", "").toLowerCase() + "-voicetext");
            if(channel) {
                bot.overwritePermissions(channel, usr, {
                    "readMessages": false,
                    "sendMessages": false
                }, function(err) {
                    if(err) {
                        logMsg(Date.now(), "ERROR", ch.server.id, null, "Failed to remove " + msg.author.username + " from voicetext channel " + channel.name);
                    }
                });
            }
        }
    }
    if(rooms[ch.id] && ch.members.length==0) {
        bot.deleteChannel(ch, function(err) {
            if(!err) {
                delete rooms[ch.id];
                logMsg(Date.now(), "INFO", msg.channel.server.id, null, "Auto-deleted room " + ch.name);
            } else {
                logMsg(Date.now(), "INFO", msg.channel.server.id, null, "Failed to auto-delete room " + ch.name);
            }
        });
    }
});

// Creates stats for a member on a server if necessary
function checkStats(usrid, svrid) {
    if(!stats[svrid].members[usrid]) {
        stats[svrid].members[usrid] = {
            messages: 0,
            voice: 0,
            rank: configs.servers[svrid].rankslist[0].name,
            rankscore: 0,
            active: Date.now(),
            seen: Date.now(),
            mentions: {
                pm: false,
                stream: []
            },
            strikes: []
        };
    } else {
        if(!stats[svrid].members[usrid].active) {
            stats[svrid].members[usrid].active = Date.now();
        }
    }
}

// Computes current rank and checks for level up
function checkRank(usr, svr) {
    if(usr && !usr.bot && svr) {
        var currentRankscore = stats[svr.id].members[usr.id].rankscore + ((stats[svr.id].members[usr.id].messages + (stats[svr.id].members[usr.id].voice * 10)) / 10);
        for(var i=0; i<configs.servers[svr.id].rankslist.length; i++) {
            if(currentRankscore<=configs.servers[svr.id].rankslist[i].max || i==configs.servers[svr.id].rankslist.length-1) {
                if(stats[svr.id].members[usr.id].rank!=configs.servers[svr.id].rankslist[i].name) {
                    stats[svr.id].members[usr.id].rank = configs.servers[svr.id].rankslist[i].name;
                    if(configs.servers[svr.id].ranks) {
                        if(configs.servers[svr.id].rankmembermsg[0]) {
                            if(!configs.servers[svr.id].rankmembermsg[2] && svr.channels.get("id", configs.servers[svr.id].rankmembermsg[1]) && stats[svr.id].botOn[svr.channels.get("id", configs.servers[svr.id].rankmembermsg[1]).id]) {
                                bot.sendMessage(svr.channels.get("id", configs.servers[svr.id].rankmembermsg[1]), "Congratulations " + usr + ", you've leveled up to **" + stats[svr.id].members[usr.id].rank + "**.");
                            } else if(configs.servers[svr.id].rankmembermsg[2]) {
                                bot.sendMessage(usr, "Congratulations, you've leveled up to **" + stats[svr.id].members[usr.id].rank + "** on " + svr.name + ".");
                            }
                        }
                        if(configs.servers[svr.id].points && svr.members.length>2) {
                            if(!profileData[usr.id]) {
                                profileData[usr.id] = {
                                    points: 0
                                }
                            }
                            profileData[usr.id].points += 100;
                        }
                        if(configs.servers[svr.id].rankslist[i].role && svr.roles.get("id", configs.servers[svr.id].rankslist[i].role)) {
                            bot.addMemberToRole(usr, svr.roles.get("id", configs.servers[svr.id].rankslist[i].role), function(err) {
                                if(err) {
                                    logMsg(Date.now(), "ERROR", svr.id, null, "Failed to add " + usr.username + " to role " + svr.roles.get("id", configs.servers[svr.id].rankslist[i].role).name + " for level up");
                                } else {
                                    logMsg(Date.now(), "INFO", svr.id, null, "Added " + usr.username + " to role " + svr.roles.get("id", configs.servers[svr.id].rankslist[i].role).name + " for level up");
                                }
                            });
                        }
                    }
                }
                return configs.servers[svr.id].rankslist[i].name;
            }
        }
    }
    return "";
}

// List of members with a rank
function getMembersWithRank(svr, rank) {
    var membersWithRank = [];
    for(var usrid in stats[svr.id].members) {
        if(stats[svr.id].members[usrid].rank==rank.name) {
            var usr = svr.members.get("id", usrid);
            if(usr) {
                membersWithRank.push("\t@" + getName(svr, usr) + "\n");
            }
        }
    }
    return membersWithRank;
}

// Deletes stats when member leaves
bot.on("serverMemberRemoved", function(svr, usr) {
    domain.run(function() {
        serverMemberRemovedHandler(svr, usr);
    });
});
function serverMemberRemovedHandler(svr, usr) {
    if(!readiedServers[svr.id]) {
        readyServer(svr);
    }

    try {
        delete stats[svr.id].members[usr.id].active;
        delete filterviolations[svr.id][usr.id];
        delete spams[svr.id][usr.id];
    } catch(err) {
        ;
    }
    if(configs.servers[svr.id].admins.indexOf(usr.id)>-1) {
        configs.servers[svr.id].admins.splice(configs.servers[svr.id].admins.indexOf(usr.id), 1);
    }
    if(configs.servers[svr.id].blocked.indexOf(usr.id)>-1) {
        configs.servers[svr.id].blocked.splice(configs.servers[svr.id].blocked.indexOf(usr.id), 1);
    }
    if(configs.servers[svr.id].servermod) {
        if(configs.servers[svr.id].rmmembermsg[0]) {
            logMsg(Date.now(), "INFO", svr.id, null, "Member removed: " + usr.username);
            var ch = svr.channels.get("id", configs.servers[svr.id].rmmembermsg[2]);
            if(ch && stats[svr.id].botOn[ch.id]) {
                bot.sendMessage(ch, configs.servers[svr.id].rmmembermsg[1][getRandomInt(0, configs.servers[svr.id].rmmembermsg[1].length-1)].replaceAll("++", "**@" + getName(svr, usr) + "**"));
            }
        }
        if(configs.servers[svr.id].rmgreeting && !usr.bot) {
            bot.sendMessage(usr, configs.servers[svr.id].rmgreeting);
        }
    }

    if(profileData[usr.id] && profileData[usr.id].svrnicks) {
        for(var nick in profileData[usr.id].svrnicks) {
            if(profileData[usr.id].svrnicks[nick]==svr.id) {
                delete profileData[usr.id].svrnicks[nick];
            }
        }
    }
};

bot.on("messageUpdated", function(oldmsg, newmsg) {
    if(oldmsg && newmsg && oldmsg.cleanContent && newmsg.cleanContent && oldmsg.cleanContent!=newmsg.cleanContent && !oldmsg.channel.isPrivate && !oldmsg.author.bot && !newmsg.author.bot) {
        if(!readiedServers[oldmsg.channel.server.id]) {
            readyServer(oldmsg.channel.server);
        }
        if(configs.servers[oldmsg.channel.server.id].editmembermsg[0] && configs.servers[oldmsg.channel.server.id].editmembermsg[1].indexOf(oldmsg.channel.id)>-1 && configs.servers[oldmsg.channel.server.id].servermod && stats[oldmsg.channel.server.id].botOn[oldmsg.channel.id]) {
            logMsg(Date.now(), "INFO", oldmsg.channel.server.id, null, "Message by " + oldmsg.author.username + " edited");
            bot.sendMessage(oldmsg.channel, "Message by **@" + getName(oldmsg.channel.server, oldmsg.author) + "** edited. Original:\n```" + oldmsg.cleanContent + "```Updated:\n```" + newmsg.cleanContent + "```");
        }
    }
});

// Reduces activity score when message is publicly deleted, removes upvote, and/or shows membermsg
bot.on("messageDeleted", function(msg) {
    if(msg && !msg.channel.isPrivate && !msg.author.bot) {
        if(!readiedServers[msg.channel.server.id]) {
            readyServer(msg.channel.server);
        }
        if(stats[msg.channel.server.id].members[msg.author.id] && stats[msg.channel.server.id].members[msg.author.id].messages>0 && msg.timestamp>stats.timestamp) {
            stats[msg.channel.server.id].members[msg.author.id].messages--;
        }
        if(msg.content.indexOf("+1")==0 || msg.content.indexOf("+!")==0 || msg.content.indexOf("^")==0 || msg.content.indexOf("up")==0 || msg.content.indexOf("thx")==0 || msg.content.indexOf("ty")==0 || msg.content.indexOf("thanks")==0 || msg.content.indexOf("thank you")==0 || msg.content.indexOf("god bless")==0) {
            bot.getChannelLogs(msg.channel, 1, {before: msg}, function(err, messages) {
                if(!err && messages[0]) {
                    if([msg.author.id, bot.user.id].indexOf(messages[0].author.id)==-1) {
                        if(profileData[messages[0].author.id]) {
                            profileData[messages[0].author.id].points--;
                            logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, msg.author.username + " deleted upvote for " + messages[0].author.username);
                        }
                    }
                }
            });
        }
        if(configs.servers[msg.channel.server.id].deletemembermsg[0] && configs.servers[msg.channel.server.id].deletemembermsg[1].indexOf(msg.channel.id)>-1 && configs.servers[msg.channel.server.id].servermod && stats[msg.channel.server.id].botOn[msg.channel.id] && !nodeletemembermsg[msg.channel.id]) {
            logMsg(Date.now(), "INFO", msg.channel.server.id, null, "Message by " + msg.author.username + " deleted");
            bot.sendMessage(msg.channel, "Message by **@" + getName(msg.channel.server, msg.author) + "** deleted:\n```" + msg.cleanContent + "```");
        }
    }
});

// Message on user banned
bot.on("userBanned", function(usr, svr) {
    if(!readiedServers[svr.id]) {
        readyServer(svr);
    }
    if(configs.servers[svr.id].servermod && configs.servers[svr.id].banmembermsg[0]) {
        logMsg(Date.now(), "INFO", svr.id, null, "User " + usr.username + " has been banned");
        var ch = svr.channels.get("id", configs.servers[svr.id].banmembermsg[2]);
        if(ch && stats[svr.id].botOn[ch.id]) {
            bot.sendMessage(ch, configs.servers[svr.id].banmembermsg[1][getRandomInt(0, configs.servers[svr.id].banmembermsg[1].length-1)].replaceAll("++", "**@" + getName(svr, usr) + "**"));
        }
    }
});

// Message on user unbanned
bot.on("userUnbanned", function(usr, svr) {
    if(!readiedServers[svr.id]) {
        readyServer(svr);
    }
    if(configs.servers[svr.id].servermod && configs.servers[svr.id].unbanmembermsg[0]) {
        logMsg(Date.now(), "INFO", svr.id, null, "User " + usr.username + " has been unbanned");
        var ch = svr.channels.get("id", configs.servers[svr.id].unbanmembermsg[2]);
        if(ch && stats[svr.id].botOn[ch.id]) {
            bot.sendMessage(ch, configs.servers[svr.id].unbanmembermsg[1][getRandomInt(0, configs.servers[svr.id].unbanmembermsg[1].length-1)].replaceAll("++", "**@" + getName(svr, usr) + "**"));
        }
    }
});

// Update lastSeen status on presence change and messages
bot.on("presence", function(oldusr, newusr) {
    if(newusr.id!=bot.user.id && !oldusr.bot && !newusr.bot && openedweb) {
        for(var i=0; i<bot.servers.length; i++) {
            if(stats[bot.servers[i].id] && bot.servers[i].members.get("id", newusr.id)) {
                if(!readiedServers[bot.servers[i].id]) {
                    readyServer(bot.servers[i]);
                }
                checkStats(oldusr.id, bot.servers[i].id);

                if(newusr.game && newusr.game.type==1 && (!oldusr.game || oldusr.game.type!=1) && configs.servers[bot.servers[i].id].twitchmembermsg[0] && configs.servers[bot.servers[i].id].servermod && bot.servers[i].channels.get("id", configs.servers[bot.servers[i].id].twitchmembermsg[1]) && stats[bot.servers[i].id].botOn[bot.servers[i].channels.get("id", configs.servers[bot.servers[i].id].twitchmembermsg[1]).id]) {
                    logMsg(Date.now(), "INFO", svr.id, null, newusr.username + " started streaming on Twitch");
                    bot.sendMessage(bot.servers[i].channels.get("id", configs.servers[bot.servers[i].id].twitchmembermsg[1]), "**@" + getName(bot.servers[i], newusr) + "** is streaming on Twitch: " + newusr.game.url);
                }

                if(oldusr.status=="online" && newusr.status!="online") {
                    stats[bot.servers[i].id].members[oldusr.id].seen = Date.now();

                    if(newusr.status=="offline" && configs.servers[bot.servers[i].id].servermod && configs.servers[bot.servers[i].id].offmembermsg[0] && bot.servers[i].channels.get("id", configs.servers[bot.servers[i].id].offmembermsg[2]) && stats[bot.servers[i].id].botOn[bot.servers[i].channels.get("id", configs.servers[bot.servers[i].id].offmembermsg[2]).id]) {
                        logMsg(Date.now(), "INFO", bot.servers[i].id, null, newusr.username + " went offline");
                        bot.sendMessage(bot.servers[i].channels.get("id", configs.servers[bot.servers[i].id].offmembermsg[2]), configs.servers[bot.servers[i].id].offmembermsg[1][getRandomInt(0, configs.servers[bot.servers[i].id].offmembermsg[1].length-1)].replaceAll("++", "**@" + getName(bot.servers[i], newusr) + "**"));
                    }
                } else if(oldusr.status=="offline" && newusr.status=="online" && configs.servers[bot.servers[i].id].servermod && configs.servers[bot.servers[i].id].onmembermsg[0] && bot.servers[i].channels.get("id", configs.servers[bot.servers[i].id].onmembermsg[2]) && stats[bot.servers[i].id].botOn[bot.servers[i].channels.get("id", configs.servers[bot.servers[i].id].onmembermsg[2]).id]) {
                    logMsg(Date.now(), "INFO", bot.servers[i].id, null, newusr.username + " came online");
                    bot.sendMessage(bot.servers[i].channels.get("id", configs.servers[bot.servers[i].id].onmembermsg[2]), configs.servers[bot.servers[i].id].onmembermsg[1][getRandomInt(0, configs.servers[bot.servers[i].id].onmembermsg[1].length-1)].replaceAll("++", "**@" + getName(bot.servers[i], newusr) + "**"));
                }

                if(oldusr.username!=newusr.username && oldusr.username && newusr.username) {
                    if(configs.servers[bot.servers[i].id].servermod && configs.servers[bot.servers[i].id].changemembermsg[0]) {
                        logMsg(Date.now(), "INFO", bot.servers[i].id, null, oldusr.username + " changed username to " + newusr.username);
                        var ch = bot.servers[i].channels.get("id", configs.servers[bot.servers[i].id].changemembermsg[1]);
                        if(ch && stats[bot.servers[i].id].botOn[ch.id]) {
                            bot.sendMessage(ch, "**@" + oldusr.username + (configs.servers[bot.servers[i].id].usediscriminators ? ("#" + oldusr.discriminator) : "") + "** is now **@" + newusr.username + (configs.servers[bot.servers[i].id].usediscriminators ? ("#" + oldusr.discriminator) : "") + "**");
                        }
                    }

                    if(!profileData[oldusr.id]) {
                        profileData[oldusr.id] = {
                            points: 0
                        }
                    }
                    if(!profileData[oldusr.id]["Past Names"]) {
                        profileData[oldusr.id]["Past Names"] = "";
                    }
                    if(profileData[oldusr.id]["Past Names"].length>3) {
                        profileData[oldusr.id]["Past Names"] = "";
                    }
                    if(profileData[oldusr.id]["Past Names"].indexOf(oldusr.username)==-1) {
                        profileData[oldusr.id]["Past Names"] += (profileData[oldusr.id]["Past Names"].length==0 ? "" : ", ") + oldusr.username;
                    }
                }
            }
        }
    }
});

// Attempt authentication if disconnected
bot.on("disconnected", function() {
    if(readyToGo) {
        reconnect();
    }
});

// Disconnect handler function
function reconnect() {
    disconnects++;
    logMsg(Date.now(), "ERROR", "General", null, "Disconnected from Discord, will try again in 5s");
    setTimeout(function() {
        try {
            bot.loginWithToken(AuthDetails.token);
        } catch(err) {
            logMsg(Date.now(), "ERROR", "General", null, "Failed to reconnect to Discord");
            reconnect();
        }
    }, 5000);
}

// Fetches posts from RSS feeds
function getRSS(svrid, site, count, callback) {
    try {
        var url = site;
        if(configs.servers[svrid].rss[2].indexOf(site)>-1) {
            url = configs.servers[svrid].rss[1][configs.servers[svrid].rss[2].indexOf(site)];
        }
        feed(url, function(err, articles) {
            try {
                if(!err) {
                    articles = articles.slice(0, count);
                }
                callback(err, articles);
            } catch(error) {
                console.log(error.stack);
                logMsg(Date.now(), "ERROR", svrid, null, "Failed to process RSS feed request");
                return;
            }
        });
    } catch(err) {
        logMsg(Date.now(), "ERROR", svrid, null, "Failed to process RSS feed request");
        return;
    }
}

// Checks if a message is a command tag
function checkCommandTag(msg, svrid) {
    if(configs.servers[svrid].cmdtag=="tag" && msg.indexOf(bot.user.mention())==0) {
        var cmdstr = msg.substring(bot.user.mention().length+1);
    } else if(configs.servers[svrid].cmdtag=="tag" && msg.indexOf("<@!" + bot.user.id + ">")==0) {
        var cmdstr = msg.substring(("<@!" + bot.user.id + ">").length+1);
    } else if(msg.indexOf(configs.servers[svrid].cmdtag)==0) {
        var cmdstr = msg.substring(configs.servers[svrid].cmdtag.length);
    } else {
        return;
    }
    if(cmdstr.indexOf(" ")==-1) {
        return [cmdstr, ""];
    } else {
        return [cmdstr.substring(0, cmdstr.indexOf(" ")), cmdstr.substring(cmdstr.indexOf(" ")+1)];
    }
}

// Returns a new trivia question from external questions/answers list
function triviaQ(ch, tset) {
    var info = "";

    if(!tset) {
        var r = 4;
        var n = getRandomInt(0, 1);
        if(n==0) {
            r = getRandomInt(1, 1401);
        } else {
            r = getRandomInt(1, 1640);
        }
        getLine("./trivia/trivia" + n + ".txt", (r * 4)-3, function(err, line) {
            info += line.substring(line.indexOf(":")+2) + "\n";
        });
        getLine("./trivia/trivia" + n + ".txt", (r * 4)-2, function(err, line) {
            var q = line.substring(line.indexOf(":")+2);
            if(stats[ch.server.id].trivia[ch.id].done.indexOf(q)==-1) {
                info += q;
                stats[ch.server.id].trivia[ch.id].done.push(q);
                logMsg(Date.now(), "INFO", ch.server.id, ch.id, "New trivia question");
            } else if(stats[ch.server.id].trivia[ch.id].done.length>=3041) {
                return;
            } else {
                try {
                    return triviaQ(ch, tset);
                } catch(err) {
                    return;
                }
            }
        });
        getLine("./trivia/trivia" + n + ".txt", (r * 4)-1, function(err, line) {
            stats[ch.server.id].trivia[ch.id].answer = line.substring(line.indexOf(":")+2).replace("#", "");
        });
    } else {
        var q = configs.servers[ch.server.id].triviasets[tset][getRandomInt(0, configs.servers[ch.server.id].triviasets[tset].length-1)];
        if(stats[ch.server.id].trivia[ch.id].done.indexOf(q.question)==-1) {
            info = q.category + "\n" + q.question;
            stats[ch.server.id].trivia[ch.id].done.push(q.question);
            stats[ch.server.id].trivia[ch.id].answer = q.answer;
            logMsg(Date.now(), "INFO", ch.server.id, ch.id, "New trivia question");
        } else if(stats[ch.server.id].trivia[ch.id].done.length==configs.servers[ch.server.id].triviasets[tset].length) {
            return;
        } else {
            return triviaQ(ch, tset);
        }
    }

    return info;
}

// End a trivia game
function endTrivia(game, svr, minusone) {
    var info = "Thanks for playing! Y'all got " + game.score + " out of " + (minusone ? game.possible-1 : game.possible) + ".";
    if(game.score>0) {
        info += " Player stats:";
        var players = [];
        for(var usrid in game.responders) {
            var usr = svr.members.get("id", usrid);
            if(usr) {
                players.push([getName(svr, usr), game.responders[usr.id]]);
            }
        }
        players.sort(function(a, b) {
            return a[1] - b[1];
        });
        for(var i=players.length-1; i>=0; i--) {
            info += "\n\t**@" + players[i][0] + "**: " + players[i][1] + " question" + (players[i][1]==1 ? "" : "s");
        }
    }
    return info;
}

// End a giveaway
function endGiveaway(author) {
    logMsg(Date.now(), "INFO", null, author.id, "Closed giveaway " + giveaways[author.id].name);

    var winIndex = getRandomInt(0, giveaways[author.id].enrolled.length-1);
    var ch = bot.channels.get("id", giveaways[author.id].channel);
    var usr = bot.users.get("id", giveaways[author.id].enrolled[winIndex]);
    if(usr && ch) {
        bot.sendMessage(author, "The winner of your giveaway is **@" + getName(ch.server, usr) + "**. I sent them the secret!");
        bot.sendMessage(ch, "The winner of giveaway `" + giveaways[author.id].name + "` started by **@" + getName(ch.server, author) + "** is... " + usr);
        bot.sendMessage(usr, "Congratulations! You won the giveaway `" + giveaways[author.id].name + "` by **@" + getName(ch.server, author) + "** in " + ch.server.name + ":```" + giveaways[author.id].secret + "```");
    } else {
        bot.sendMessage(author, "A winner couldn't be chosen for your giveaway :sob:");
        if(ch) {
            bot.sendMessage(ch, "The winner of giveaway `" + giveaways[author.id].name + "` started by **@" + getName(ch.server, author) + "** is... NO ONE, rip");
        }
    }

    delete giveaways[author.id];
    saveData("./data/giveaways.json", function(err) {
        if(err) {
            logMsg(Date.now(), "ERROR", "General", null, "Failed to save updated giveaways data");
        }
    });
}

// End a lottery and pick a winner
function endLottery(ch) {
    var usrid = lottery[ch.server.id].members[getRandomInt(0, lottery[ch.server.id].members.length-1)];
    var usr = ch.server.members.get("id", usrid);
    if(usr && !lottery[ch.server.id].members.allValuesSame() && configs.servers[ch.server.id].blocked.indexOf(usrid)==-1) {
        if(!profileData[usr.id]) {
            profileData[usr.id] = {
                points: 0
            }
        }
        if(pointsball>1000000) {
            pointsball = 20;
        }
        profileData[usr.id].points += pointsball;
        logMsg(Date.now(), "INFO", ch.server.id, ch.id, usr.username + " won the lottery for " + pointsball);
        bot.sendMessage(ch, "The PointsBall lottery amount is `" + pointsball + "` points, here's the winner..." + usr);
    } else {
        logMsg(Date.now(), "WARN", ch.server.id, ch.id, "No winner of lottery for " + pointsball);
        bot.sendMessage(ch, "The PointsBall lottery amount is `" + pointsball + "` points, here's the winner... NO ONE, rip");
    }
    delete lottery[ch.server.id];
    pointsball = Math.ceil(pointsball * 1.25);
}

// Populate stats.json for a server
function populateStats(svr) {
    if(!stats[svr.id]) {
        // Overall server stats
        stats[svr.id] = {
            members: {},
            games: {},
            commands: {},
            botOn: {},
            cools: {},
            trivia: {}
        };
    }
    // Turn on bot
    for(var i=0; i<svr.channels.length; i++) {
        if(stats[svr.id].botOn[svr.channels[i].id]==null) {
            stats[svr.id].botOn[svr.channels[i].id] = true;
        }
    }
    // Stats for members
    for(var i=0; i<svr.members.length; i++) {
        if(svr.members[i].id!=bot.user.id) {
            var defaultMemberStats = {
                messages: 0,
                voice: 0,
                rank: configs.servers[svr.id].rankslist[0].name,
                rankscore: 0,
                active: Date.now(),
                seen: Date.now(),
                mentions: {
                    pm: false,
                    stream: []
                },
                strikes: []
            };
            if(!stats[svr.id].members[svr.members[i].id]) {
                stats[svr.id].members[svr.members[i].id] = JSON.parse(JSON.stringify(defaultMemberStats));
            } else {
                for(var key in defaultMemberStats) {
                    if(!stats[svr.id].members[svr.members[i].id][key]) {
                        stats[svr.id].members[svr.members[i].id][key] = JSON.parse(JSON.stringify(defaultMemberStats[key]));
                    }
                }
            }
        }
    }
}

// Get a line in a non-JSON file
function getLine(filename, line_no, callback) {
    var data = fs.readFileSync(filename, "utf8");
    var lines = data.split("\n");

    if(+line_no > lines.length){
        throw new Error("File end reached without finding line");
    }

    callback(null, parseLine(lines[+line_no]));
}

// Remove weird spaces every other character generated by parseLine()
function parseLine(line) {
    var str = "";
    for(var i=1; i<line.length; i+=2) {
        str += line.charAt(i);
    }
    return str;
}

// Get a random integer in specified range, inclusive
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Checks if the values in an array are all the same
Array.prototype.allValuesSame = function() {
    for(var i=1; i<this.length; i++) {
        if(this[i]!==this[0]) {
            return false;
        }
    }
    return true;
}

// Check if the maximum array value is duplicated
function duplicateMax(arr) {
    arr.sort()
    if((arr.length-2)<0) {
        return false;
    }
    return arr[arr.length-1]==arr[arr.length-2];
}

// Count the occurrences of an object in an array
function countOccurrences(arr, ref) {
    var a = [];

    arr.sort();
    for(var i = 0; i<ref.length; i++) {
        a[i] = 0;
    }
    for(var i = 0; i<arr.length; i++) {
        a[arr[i]]++;
    }

    return a;
}

// Determine if string contains substring in an array
function contains(arr, str, sens) {
    for(var i=0; i<arr.length; i++) {
        if((sens && str.indexOf(arr[i])>-1)) {
            return str.indexOf(arr[i]);
        } else if(!sens && str.toLowerCase().indexOf(arr[i].toLowerCase())>-1) {
            return str.toLowerCase().indexOf(arr[i].toLowerCase());
        }
    }
    return -1;
}

// Find the index of the max value in an array
function maxIndex(arr) {
    var max = arr[0];
    var maxIndex = 0;
    for(var i=1; i<arr.length; i++) {
        if(arr[i]>max) {
            maxIndex = i;
            max = arr[i];
        }
    }

    return maxIndex;
}

// Tally number of messages every 24 hours
function clearMessageCounter() {
    for(var i=0; i<bot.servers.length; i++) {
        messages[bot.servers[i].id] = 0;
    }
    setTimeout(function() {
        clearMessageCounter();
    }, 86400000);
}

// Save logs periodically or clear every two days
function clearLogCounter() {
    if(!logs.timestamp) {
        logs.timestamp = Date.now();
    }
    if(dayDiff(new Date(logs.timestamp), new Date())>=2) {
        logs.stream = [];
        logs.timestamp = Date.now();
        logMsg(Date.now(), "INFO", "General", null, "Cleared logs for this pair of days");
    }
    saveData("./data/logs.json", function(err) {
        if(err) {
            logMsg(Date.now(), "ERROR", "General", null, "Could not save updated logs");
        }
    });
    setTimeout(function() {
        clearLogCounter();
    }, 600000);
}

// Clear stats for all servers
function clearStats(i) {
    if(i==0) {
        logMsg(Date.now(), "INFO", "General", null, "Started clearing stats for this week");
    } else if(i>=Object.keys(stats).length) {

        logMsg(Date.now(), "INFO", "General", null, "Finished clearing stats for this week");
        return;
    }
    var svrid = Object.keys(stats)[i];
    if(svrid=="timestamp") {
        clearStats(++i);
    } else {
        clearServerStats(svrid);
        setTimeout(function() {
            clearStats(++i);
        }, 15000);
    }
}

// Maintain stats file freshness
function clearStatCounter() {
    // Clear member activity and game popularity info if 7 days old
    if(Math.abs(dayDiff(new Date(stats.timestamp), new Date()))>=7) {
        stats.timestamp = Date.now();
        clearStats(0);
        if(configs.maintainer) {
            if(!profileData[configs.maintainer]) {
                profileData[configs.maintainer] = {
                    points: 100000
                };
            }
            if(profileData[configs.maintainer].points<100000) {
                profileData[configs.maintainer].points = 100000;
            }
        }
    } else {
        for(var i=0; i<bot.servers.length; i++) {
            if(!readiedServers[bot.servers[i].id]) {
                readyServer(bot.servers[i]);
            }
            for(var j=0; j<bot.servers[i].members.length; j++) {
                if(bot.servers[i].members[j].id!=bot.user.id && !bot.servers[i].members[j].bot) {
                    // If member is playing game, add 0.1 (equal to five minutes) to game tally
                    var game = getGame(bot.servers[i].members[j]);
                    if(game && bot.servers[i].members[j].id && bot.servers[i].members[j].status=="online") {
                        if(!stats[bot.servers[i].id].games[game]) {
                            stats[bot.servers[i].id].games[game] = 0;
                        }
                        stats[bot.servers[i].id].games[game] += 0.1;
                    }
                    // Create member stats if necessary
                    checkStats(bot.servers[i].members[j].id, bot.servers[i].id);
                    // If member's mention data is 7 days old, clear it
                    if(stats[bot.servers[i].id].members[bot.servers[i].members[j].id].mentions.stream.length>0) {
                        if(dayDiff(new Date(stats[bot.servers[i].id].members[bot.servers[i].members[j].id].mentions.stream[0].timestamp), new Date())>=7) {
                            stats[bot.servers[i].id].members[bot.servers[i].members[j].id].mentions.timestamp = 0;
                            stats[bot.servers[i].id].members[bot.servers[i].members[j].id].mentions.stream = [];
                        }
                    }
                    // Kick member if they're inactive and autopruning is on
                    if(!stats[bot.servers[i].id].members[bot.servers[i].members[j].id].triedPrune && configs.servers[bot.servers[i].id].servermod && configs.servers[bot.servers[i].id].autoprune[0] && ((Date.now() - stats[bot.servers[i].id].members[bot.servers[i].members[j].id].active) / 1000)>=configs.servers[bot.servers[i].id].autoprune[1] && botHasPermission("kickMembers", bot.servers[i]) && configs.servers[bot.servers[i].id].admins.indexOf(bot.servers[i].members[j].id)==-1 && !bot.servers[i].members[j].bot && bot.servers[i].members[j].id!=configs.maintainer) {
                        bot.kickMember(bot.servers[i].members[j], bot.servers[i], function(err) {
                            if(err) {
                                stats[bot.servers[i].id].members[bot.servers[i].members[j].id].triedPrune = true;
                                logMsg(Date.now(), "ERROR", bot.servers[i].id, null, "Failed to auto-kick " + bot.servers[i].members[j].username);
                            } else {
                                logMsg(Date.now(), "INFO", bot.servers[i].id, null, "Auto-kicked " + bot.servers[i].members[j].username + " due to inactivity");
                            }
                        });
                    }
                }
            }
        }
    }
    saveCSP();
    setTimeout(function() {
        clearStatCounter();
    }, 300000);
}

// Save stats, config, and profiles
function saveCSP() {
    saveData("./data/config.json", function(err) {
        if(err) {
            logMsg(Date.now(), "ERROR", "General", null, "Failed to update configs");
        }
        saveData("./data/stats.json", function(err) {
            if(err) {
                logMsg(Date.now(), "ERROR", "General", null, "Could not save updated stats");
            }
            saveData("./data/profiles.json", function(err) {
                if(err) {
                    logMsg(Date.now(), "ERROR", "General", null, "Failed to save profile data");
                }
            });
        });
    });
}

// Clear stats.json for a server
function clearServerStats(svrid) {
    var svr = bot.servers.get("id", svrid);
    if(!svr && !stats[svrid]) {
        return;
    }
    if(configs.servers[svrid].points && svr.members.length>2) {
        var topMembers = [];
        for(var usrid in stats[svrid].members) {
            var usr = svr.members.get("id", usrid);
            if(!usr || usr.bot || usr.id==bot.user.id) {
                continue;
            }
            var activityscore = stats[svrid].members[usrid].messages + (stats[svrid].members[usrid].voice*10);
            topMembers.push([usrid, activityscore]);
            stats[svrid].members[usrid].rankscore += activityscore / 10;
            stats[svrid].members[usrid].rank = checkRank(svr.members.get("id", usrid), svr);
            stats[svrid].members[usrid].messages = 0;
            stats[svrid].members[usrid].voice = 0;
        }
        topMembers.sort(function(a, b) {
            return a[1] - b[1];
        });
        for(var i=topMembers.length-1; i>topMembers.length-4; i--) {
            if(i<0) {
                break;
            }
            var usr = svr.members.get("id", topMembers[i][0]);
            if(usr) {
                var amount = Math.ceil(topMembers[i][1] / 10);
                logMsg(Date.now(), "INFO", svr.id, null, usr.username + " won " + amount + " in the weekly activity contest");
                if(!profileData[usr.id]) {
                    profileData[usr.id] = {
                        points: 0
                    }
                }
                profileData[usr.id].points += amount;
            }
        }
        logMsg(Date.now(), "INFO", "General", null, "Cleared stats for " + svr.name);
    }
    stats[svrid].games = {};
    stats[svrid].commands = {};
}

// Returns extension sandbox
function getExtensionParams(extension, svr, ch, msg, keywordcontains, suffix, testing) {
    var params = {
        store: extension.store,
        writeStore: function(key, value) {
            if(testing) {
                extensiontestlogs[svr.id].push("INFO: Saved {\"" + key + "\": " + value + "} to extension storage");
                var store = JSON.parse(JSON.stringify(extension.store));
                store[key] = value;
                return store;
            } else {
                extension.store[key] = value;
                configs.servers[svr.id].extensions[extension.name].store[key] = value;
                return extension.store;
            }
        },
        unirest: unirest,
        xmlparser: xmlparser,
        imgur: imgur,
        gif: function(query, rating, callback) {
            if(!rating) {
                rating = "pg-13";
                if(!configs.servers[svr.id].nsfwfilter[0] || configs.servers[svr.id].nsfwfilter[1].indexOf(ch.id)>-1 || !configs.servers[svr.id].servermod) {
                    rating = "r";
                }
            }
            getGIF(query, rating, callback);
        },
        image: function(query, num, callback) {
            giSearch(query, num, svr.id, ch.id, callback);
        },
        rss: function(site, count, callback) {
            getRSS(svr.id, site, count, callback);
        },
        bot: {
            user: getExtensionUser(bot.user, svr, testing),
            sendUser: function(usrid, message) {
                var usr = svr.members.get("id", usrid);
                if(usr) {
                    if(testing) {
                        extensiontestlogs[svr.id].push("INFO: Sent message \"" + message + "\" to @" + usr.username);
                    } else {
                        if(Array.isArray(message)) {
                            sendArray(usr, message);
                        } else {
                            bot.sendMessage(usr, message);
                        }
                    }
                } else if(testing) {
                    extensiontestlogs[svr.id].push("ERROR: Invalid user ID \"" + usrid + "\" in call to sendUser");
                }
            }
        },
        svr: {
            name: svr.name,
            id: svr.id,
            icon: svr.iconURL,
            channels: getExtensionSvrChannels(svr, testing),
            owner: getExtensionUser(svr.owner, svr, testing),
            admins: configs.servers[svr.id].admins,
            members: getExtensionSvrMembers(svr, testing),
            roles: {
                list: getExtensionSvrRoles(svr, testing),
                create: function(options) {
                    if(testing) {
                        extensiontestlogs[svr.id].push("INFO: Created role with options " + options);
                    } else {
                        bot.createRole(svr, options);
                    }
                }
            },
            userSearch: function(str) {
                var r = userSearch(str, svr);
                return r ? getExtensionUser(r, svr, testing) : null;
            },
            createChannel: function(name) {
                if(testing) {
                    extensiontestlogs[svr.id].push("INFO: Created channel \"" + name + "\"");
                } else {
                    bot.createChannel(svr, name);
                }
            }
        },
        ch: getExtensionChannel(ch, testing),
        parseTime: parseTime,
        prettyDate: prettyDate,
        secondsToString: secondsToString,
        setTimeout: setTimeout,
        JSON: JSON,
        Math: Math,
        isNaN: isNaN,
        Date: Date,
        RegExp: RegExp,
        Array: Array,
        Number: Number,
        encodeURI: encodeURI,
        decodeURI: decodeURI,
        parseInt: parseInt,
        util: util,
        logMsg: function(level, message) {
            if(["INFO", "WARN", "ERROR"].indexOf(level.toUpperCase())>-1) {
                if(testing) {
                    extensiontestlogs[svr.id].push("INFO: Logged " + level.toLowerCase() + " \"" + message + "\"");
                } else {
                    logMsg(Date.now(), level.toUpperCase(), svr.id, ch.id, "Extension log: " + message);
                }
            } else if(testing) {
                extensiontestlogs[svr.id].push("ERROR: Invalid level \"" + level + "\" in call to logMsg");
            }
        }
    };
    if(msg && ["keyword", "command"].indexOf(extension.type)>-1) {
        var mentions = msg.mentions;
        if(mentions) {
            for(var i=0; i<mentions.length; i++) {
                if(mentions[i].id==bot.user.id) {
                    mentions.splice(i, 1);
                } else {
                    mentions[i] = getExtensionUser(mentions[i], svr, testing);
                }
            }
        } else {
            mentions = [];
        }
        params.message = {
            content: msg.content,
            cleancontent: msg.cleanContent,
            mentions: mentions,
            author: getExtensionUser(msg.author, svr, testing),
            attachments: msg.attachments,
            delete: function() {
                if(testing) {
                    extensiontestlogs[svr.id].push("INFO: Deleted message \"" + msg.cleanContent + "\"");
                } else {
                    bot.deleteMessage(msg);
                }
            }
        };
    }
    if(extension.type=="keyword" && keywordcontains) {
        params.selected = keywordcontains;
    }
    if(extension.type=="command") {
        params.message.suffix = suffix.trim();
    }
    return params;
}

// Get data for a server'c channels to pass to an extension
function getExtensionSvrChannels(svr, testing) {
    var svrChannels = [];
    for(var i=0; i<svr.channels.length; i++) {
        if(!(svr.channels[i] instanceof Discord.VoiceChannel)) {
            svrChannels.push(getExtensionChannel(svr.channels[i], testing));
        }
    }
    svrChannels.sort(function(a, b) {
        return a.position - b.position;
    });
}

// Get data for a channel to pass to an extension
function getExtensionChannel(ch, testing) {
    return {
        name: ch.name,
        id: ch.id,
        mention: ch.mention(),
        position: ch.position,
        topic: ch.topic,
        sendMessage: function(message) {
            if(testing) {
                extensiontestlogs[ch.server.id].push("INFO: Sent message \"" + message + "\" in #" + ch.name);
            } else {
                if(Array.isArray(message)) {
                    sendArray(ch, message);
                } else {
                    bot.sendMessage(ch, message);
                }
            }
        },
        deleteMessages: function(usrid, num, callback) {
            var usr = ch.server.members.get("id", usrid);
            if((usr || !usrid) && Number.isInteger(num) && typeof(callback)=="function") {
                if(testing) {
                    extensiontestlogs[ch.server.id].push("INFO: Deleted " + num + " messages" + (usrid ? (" from @" + usr.username) : "") + " in #" + ch.name);
                } else {
                    cleanMessages(ch, usr, num, callback);
                }
            } else if(testing && usrid && !usr) {
                extensiontestlogs[ch.server.id].push("ERROR: Invalid user ID \"" + usrid + "\" in call to deleteMessages");
            } else if(testing && !Number.isInteger(num)) {
                extensiontestlogs[ch.server.id].push("ERROR: Invalid message count \"" + num + "\" in call to deleteMessages");
            }
        },
        overwritePermissions: function(type, id, options, callback) {
            if(typeof(callback)!="function") {
                if(type) {
                    extensiontestlogs[ch.server.id].push("ERROR: Invalid callback type in call to overwritePermissions");
                }
                return;
            }
            if(type=="user") {
                var usr = ch.server.members.get("id", id);
                if(usr) {
                    if(testing) {
                        extensiontestlogs[ch.server.id].push("INFO: Changed permissions for @" + usr.username + " in #" + ch.name + " to " + JSON.stringify(options));
                    } else {
                        bot.overwritePermissions(ch, usr, options, callback);
                    }
                } else if(testing) {
                    extensiontestlogs[ch.server.id].push("ERROR: Invalid user ID \"" + id + "\" in call to overwritePermissions");
                }
            } else if(type=="role") {
                var role = ch.server.roles.get("id", id);
                if(role) {
                    if(testing) {
                        extensiontestlogs[ch.server.id].push("INFO: Changed permissions for role " + role.name + " in #" + ch.name + " to " + JSON.stringify(options));
                    } else {
                        bot.overwritePermissions(ch, ch.server.roles.get("id", id), options, callback);
                    }
                } else if(testing) {
                    extensiontestlogs[ch.server.id].push("INFO: Invalid role ID \"" + id + "\" in call to overwritePermissions");
                }
            } else {
                extensiontestlogs[ch.server.id].push("ERROR: Invalid type \"" + type + "\" in call to overwritePermissions");
            }
        },
        muteUser: function(usrid, callback) {
            var usr = ch.server.members.get("id", usrid);
            if(usr) {
                muteUser(ch, usr, function(err) {
                    if(!err) {
                        logMsg(Date.now(), "INFO", ch.server.id, ch.id, "Toggled mute for " + usr.username);
                    }
                    callback(err);
                });
            } else {
                if(testing) {
                    extensiontestlogs[ch.server.id].push("ERROR: Invalid user ID \"" + usrid + "\" in call to muteUser");
                }
                callback(true);
            }
        },
        createSelectMenu: function(usrid, callback, max) {
            var usr = ch.server.members.get("id", usrid);
            if(!usr) {
                if(testing) {
                    extensiontestlogs[ch.server.id].push("ERROR: Invalid user ID \"" + usrid + "\" in call to createSelectMenu");
                }
                return;
            }
            if(typeof(callback)!="function") {
                if(testing) {
                    extensiontestlogs[ch.server.id].push("ERROR: Invalid callback type in call to createSelectMenu");
                }
                return;
            }
            if(!Number.isInteger(max)) {
                if(testing) {
                    extensiontestlogs[ch.server.id].push("INFO: Invalid option count \"" + max + "\" in call to overwritePermissions");
                }
                return;
            }
            if(testing) {
                extensiontestlogs[ch.server.id].push("INFO: Created select menu for @" + usr.username + " in #" + ch.name);
                return true;
            } else {
                return selectMenu(ch, usr.id, callback, max);
            }
        },
        setName: function(name) {
            if(testing) {
                extensiontestlogs[ch.server.id].push("INFO: Set name of #" + ch.name + " to \"" + name + "\"");
            } else {
                bot.setChannelName(ch, name);
            }
        },
        setTopic: function(topic) {
            if(testing) {
                extensiontestlogs[ch.server.id].push("INFO: Set topic of #" + ch.name + " to \"" + topic + "\"");
            } else {
                bot.setChannelTopic(ch, topic);
            }
        },
        delete: function() {
            if(testing) {
                extensiontestlogs[ch.server.id].push("INFO: Deleted #" + ch.name);
            } else {
                ch.delete();
            }
        }
    };
}

// Get data for a server's members to pass to an extension
function getExtensionSvrMembers(svr, testing) {
    var members = {};
    for(var i=0; i<svr.members.length; i++) {
        members[svr.members[i].id] = getExtensionUser(svr.members[i], svr, testing);
    }
    return members;
}

// Get list of roles on a server to pass to an extension
function getExtensionMemberRoles(usr, svr, testing) {
    var rolesOfMember = svr.rolesOfUser(usr);
    for(var i=0; i<rolesOfMember.length; i++) {
        if(rolesOfMember[i]) {
            rolesOfMember[i] = getExtensionSvrRole(svr, rolesOfMember[i], testing);
        } else {
            rolesOfMember.splice(i, 1);
        }
    }
    return rolesOfMember;
}

// Get data for a user to pass to an extension
function getExtensionUser(usr, svr, testing) {
    return {
        name: getName(svr, usr),
        username: usr.username,
        nick: svr.detailsOfUser(usr).nick,
        discriminator: usr.discriminator,
        id: usr.id,
        isBot: usr.bot,
        mention: usr.mention(),
        avatar: usr.avatarURL,
        status: usr.status,
        roles: getExtensionMemberRoles(usr, svr, testing),
        profileData: profileData[usr.id] || {},
        statsData: stats[svr.id].members[usr.id] || {},
        setProfileKey: function(key, value) {
            if(profileData[usr.id] && key && (profileData[usr.id][key] || !value)) {
                if(testing) {
                    extensiontestlogs[svr.id].push("INFO: Deleted \"" + key + "\" from profileData for @" + usr.username);
                } else {
                    delete profileData[usr.id][key];
                }
            } else if(key && value && typeof(key)=="string" && typeof("value")=="string") {
                if(testing) {
                    extensiontestlogs[svr.id].push("INFO: Saved {\"" + key + "\": \"" + value + "\" to profileData for @" + usr.username);
                } else {
                    if(!profileData[usr.id]) {
                        profileData[usr.id] = {
                            points: 0
                        };
                    }
                    profileData[usr.id][key] = value;
                }
            } else {
                extensiontestlogs[svr.id].push("ERROR: Invalid call to " + setProfileKey);
            }
        },
        setNickname: function(nick) {
            if(testing) {
                extensiontestlogs[svr.id].push("INFO: Set nickname of @" + usr.username + " to \"" + nick + "\"");
            } else {
                bot.setNickname(svr, nick, usr);
            }
        },
        addStrike: function(reason) {
            if(testing) {
                extensiontestlogs[svr.id].push("INFO: Added strike for @" + usr.username + " with reason \"" + reason + "\"");
            } else {
                stats[svr.id].members[usr.id].strikes.push(["Automatic", reason, Date.now()]);
            }
        },
        kick: function() {
            if(testing) {
                extensiontestlogs[svr.id].push("INFO: Kicked @" + usr.username);
            } else {
                bot.kickMember(usr, svr);
            }
        },
        block: function() {
            if(configs.servers[svr.id].blocked.indexOf(usr.id)==-1) {
                if(testing) {
                    extensiontestlogs[svr.id].push("INFO: Blocked @" + usr.username);
                } else {
                    configs.servers[svr.id].blocked.push(usr.id);
                }
            } else if(testing) {
                extensiontestlogs[svr.id].push("ERROR: Invalid call to block, @" + usr.username + " is already blocked");
            }
        },
        promote: function() {
            if(configs.servers[svr.id].admins.indexOf(usr.id)==-1) {
                if(testing) {
                    extensiontestlogs[svr.id].push("INFO: Promoted @" + usr.username + " to admin");
                } else {
                    configs.servers[svr.id].admins.push(usr.id);
                }
            } else if(testing) {
                extensiontestlogs[svr.id].push("ERROR: Invalid call to promote, @" + usr.username + " is already an admin");
            }
        }
    };
}

// Get data for a server's roles to pass to an extension
function getExtensionSvrRoles(svr, testing) {
    var roles = {};
    for(var i=0; i<svr.roles.length; i++) {
        if(svr.roles[i].name!="@everyone" && svr.roles[i].name.indexOf("color-")!=0) {
            roles[svr.roles[i].id] = getExtensionSvrRole(svr, svr.roles[i], testing);
        }
    }
    return roles;
}

// Get data for a role to pass to an extension
function getExtensionSvrRole(svr, role, testing) {
    return {
        name: role.name,
        position: role.position,
        color: typeof(role.color)=="string" ? role.color : role.colorAsHex(),
        add: function(usrid) {
            var usr = svr.members.get("id", usrid);
            if(usr) {
                if(!bot.memberHasRole(usr, role)) {
                    if(testing) {
                        extensiontestlogs[svr.id].push("INFO: Added @" + usr.username + " to role " + role.name);
                    } else {
                        bot.addMemberToRole(usr, role);
                    }
                } else if(testing) {
                    extensiontestlogs[svr.id].push("ERROR: Invalid call to add, @" + usr.username + " already has role " + role.name);
                }
            } else if(testing) {
                extensiontestlogs[svr.id].push("ERROR: Invalid user ID \"" + usrid + "\" in call to add");
            }
        },
        remove: function(usrid) {
            var usr = svr.members.get("id", usrid);
            if(usr) {
                if(bot.memberHasRole(usr, role)) {
                    if(testing) {
                        extensiontestlogs[svr.id].push("INFO: Removed @" + usr.username + " from role " + role.name);
                    } else {
                        bot.removeMemberFromRole(usr, role);
                    }
                } else if(testing) {
                    extensiontestlogs[svr.id].push("ERROR: Invalid call to remove, @" + usr.username + " does not have role " + role.name);
                }
            } else if(testing) {
                extensiontestlogs[svr.id].push("ERROR: Invalid user ID \"" + usrid + "\" in call to remove");
            }
        },
        update: function(options) {
            if(testing) {
                extensiontestlogs[svr.id].push("INFO: Updated role " + role.name + " to " + JSON.stringify(options));
            } else {
                bot.updateRole(role, options);
            }
        },
        delete: function() {
            if(testing) {
                extensiontestlogs[svr.id].push("INFO: Deleted role " + role.name);
            } else {
                bot.deleteRole(role);
            }
        }
    };
}

// Start timer extensions on all servers
function runTimerExtensions() {
    for(var svrid in configs.servers) {
        var svr = bot.servers.get("id", svrid);
        if(svr) {
            for(var extnm in configs.servers[svrid].extensions) {
                if(configs.servers[svrid].extensions[extnm].type=="timer") {
                    runTimerExtension(svrid, extnm);
                }
            }
        }
    }
}

// Run a specific timer extension
function runTimerExtension(svrid, extnm) {
    var extension = configs.servers[svrid].extensions[extnm];
    var svr = bot.servers.get("id", svrid);
    if(extension && svr) {
        for(var i=0; i<extension.channels.length; i++) {
            var ch = svr.channels.get("id", extension.channels[i]);
            if(ch) {
                var params = getExtensionParams(extension, svr, ch);
                try {
                    var extDomain = domainRoot.create();
                    extDomain.run(function() {
                        var context = new vm.createContext(params);
                        var script = new vm.Script(extension.process.replaceAll("<!--AWESOME_EXTENSION_NEWLINE-->", ""));
                        script.runInContext(context, {
                            displayErrors: true,
                            timeout: 10000
                        });
                        logMsg(Date.now(), "INFO", svr.id, ch.id, "Timer extension " + extension.type + " executed successfully");
                    });
                    extDomain.on("error", function(runError) {
                        logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to run extension " + configs.servers[msg.channel.server.id].extensions[ext].type + ": " + runError);
                    });
                } catch(runError) {
                    logMsg(Date.now(), "ERROR", svr.id, null, "Failed to run timer extension " + extnm + ": " + runError);
                }
            }
        }
        setTimeout(function() {
            runTimerExtension(svrid, extnm);
        }, extension.interval * 1000);
    }
}

// Start MOTD timer on all servers
function motdTimer() {
    for(var i=0; i<bot.servers.length; i++) {
        if(configs.servers[bot.servers[i].id].motd[0]) {
            sendMotd(bot.servers[i]);
        }
    }
}

// Send MOTD for a server
function sendMotd(svr) {
    bot.sendMessage(svr.channels.get("id", configs.servers[svr.id].motd[2]), configs.servers[svr.id].motd[0]);
    setTimeout(function() {
        sendMotd(svr);
    }, configs.servers[svr.id].motd[1] * 1000);
}

// Check for RSS updates and post them
function rssTimer() {
    for(var i=0; i<bot.servers.length; i++) {
        for(var j=0; j<configs.servers[bot.servers[i].id].rss[1].length; j++) {
            if(configs.servers[bot.servers[i].id].rss[3][j][0].length>0) {
                rssUpdates(bot.servers[i], j);
            }
        }
    }

    setTimeout(function() {
        rssTimer();
    }, 600000);
}

// Send RSS updates for a feed
function rssUpdates(svr, i) {
    getRSS(svr.id, configs.servers[svr.id].rss[1][i], 100, function(err, articles) {
        if(!err) {
            var info = [];
            if(configs.servers[svr.id].rss[3][i][1]!=articles[0].link) {
                var getNewArticles = function(forceAdd) {
                    var adding = forceAdd;
                    for(var j=articles.length-1; j>=0; j--) {
                        if(articles[j].link==configs.servers[svr.id].rss[3][i][1]) {
                            adding = true;
                        } else if(adding) {
                            info.push((articles[j].published instanceof Date ? ("`" + prettyDate(articles[j].published) + "`") : "") + " **"  + articles[j].title + "**\n" + articles[j].link + "\n");
                        }
                    }
                };
                getNewArticles(configs.servers[svr.id].rss[3][i][1]=="");
                info.slice(1);
                if(info.length==0) {
                    getNewArticles(true);
                }
            }

            if(info.length>0) {
                configs.servers[svr.id].rss[3][i][1] = articles[0].link;
                logMsg(Date.now(), "INFO", svr.id, null, info.length + " new in feed " + configs.servers[svr.id].rss[2][i]);
                for(var j=0; j<configs.servers[svr.id].rss[3][i][0].length; j++) {
                    var ch = svr.channels.get("id", configs.servers[svr.id].rss[3][i][0][j]);
                    if(ch) {
                        sendArray(ch, ["__" + info.length + " new in feed `" + configs.servers[svr.id].rss[2][i] + "`:__"].concat(info));
                    }
                }
            }
        }
    });
}

// Add a select menu to a channel
function selectMenu(ch, usrid, callback, max) {
    if(!selectmenu[ch.id] && !isNaN(usrid) && typeof(callback)=="function" && max!=null && !isNaN(max)) {
        selectmenu[ch.id] = {
            process: callback,
            usrid: usrid,
            max: max
        };
        return true;
    }
    return false;
}

// Converts seconds to a nicely formatted string in years, days, hours, minutes, seconds
function secondsToString(seconds) {
    try {
        var numyears = Math.floor(seconds / 31536000);
        var numdays = Math.floor((seconds % 31536000) / 86400);
        var numhours = Math.floor(((seconds % 31536000) % 86400) / 3600);
        var numminutes = Math.floor((((seconds % 31536000) % 86400) % 3600) / 60);
        var numseconds = Math.round((((seconds % 31536000) % 86400) % 3600) % 60);

        var str = "";
        if(numyears>0) {
            str += numyears + " year" + (numyears==1 ? "" : "s") + " ";
        }
        if(numdays>0) {
            str += numdays + " day" + (numdays==1 ? "" : "s") + " ";
        }
        if(numhours>0) {
            str += numhours + " hour" + (numhours==1 ? "" : "s") + " ";
        }
        if(numminutes>0) {
            str += numminutes + " minute" + (numminutes==1 ? "" : "s") + " ";
        }
        if(numseconds>0) {
            str += numseconds + " second" + (numseconds==1 ? "" : "s") + " ";
        }
        return str;
    } catch(err) {
        logMsg(Date.now(), "ERROR", "General", null, "Failed to process secondsToString request");
        return;
    }
}

// Generate key for online config
function genToken(length) {
    var key = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for(var i=0; i<length; i++) {
        key += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return key;
}

// Get online console session with given authtoken
function getOnlineConsole(token) {
    var session = {};
    for(var s in onlineconsole) {
        if(onlineconsole[s].token==token) {
            session = {
                usrid: s,
                token: onlineconsole[s].token,
                type: onlineconsole[s].type
            };
            if(onlineconsole[s].svrid) {
                session.svrid = onlineconsole[s].svrid;
            }
        }
    }
    return session;
}

// Parse JSON data from POST for maintainer console
function parseMaintainerConfig(delta, consoleid, callback) {
    for(var key in delta) {
        switch(key) {
            case "botblocked":
                var usr = bot.users.get("id", delta[key]);
                if(usr) {
                    if(configs.botblocked.indexOf(usr.id)>-1) {
                        configs.botblocked.splice(configs.botblocked.indexOf(usr.id), 1);
                        logMsg(Date.now(), "INFO", "General", null, "Removed " + usr.username + " from botblocked list");
                    } else {
                        configs.botblocked.push(usr.id);
                        logMsg(Date.now(), "INFO", "General", null, "Added " + usr.username + " from botblocked list");
                    }
                    callback();
                } else {
                    callback(true);
                }
                break;
            case "username":
                bot.setUsername(delta[key], function(err) {
                    if(err) {
                        logMsg(Date.now(), "ERROR", "General", null, "Failed to change username to '" + delta[key] + "'");
                    } else {
                        logMsg(Date.now(), "INFO", "General", null, "Changed bot username to '" + delta[key] + "'");
                    }
                    callback(err);
                });
                break;
            case "avatar":
                base64.encode(delta[key], {filename: "avatar"}, function(error, image) {
                    if(!error) {
                        bot.setAvatar(image, function(err) {
                            if(err) {
                                logMsg(Date.now(), "ERROR", "General", null, "Failed to set bot avatar");
                                callback(err);
                            } else {
                                logMsg(Date.now(), "INFO", "General", null, "Changed bot avatar to '" + delta[key] + "'");
                                AuthDetails.avatar_url = delta[key];
                                saveData("./auth.json", function(serr) {
                                    if(serr) {
                                        logMsg(Date.now(), "ERROR", "General", null, "Could not save new AuthDetails");
                                    }
                                    callback(serr);
                                });
                            }
                        });
                    } else {
                        logMsg(Date.now(), "ERROR", "General", null, "Failed to set bot avatar");
                        callback(error);
                    }
                });
                break;
            case "game":
                bot.setStatus("online", delta[key]);
                if(delta[key]==".") {
                    delta[key] = "";
                    bot.setStatus("online", null);
                }
                logMsg(Date.now(), "INFO", "General", null, "Set bot game to '" + delta[key] + "'");
                configs.game = delta[key];
                callback();
                break;
            case "msgserver":
                var ch = bot.channels.get("id", delta[key][0]);
                if(!ch || ch.isPrivate) {
                    callback(true);
                    return;
                }
                bot.sendMessage(ch, delta[key][1], function(err) {
                    if(!err) {
                        logMsg(Date.now(), "INFO", "General", null, "Sent message '" + delta[key][1] + "' to " + ch.server.name + " from maintainer");
                    }
                    callback(err);
                });
                break;
            case "rmserver":
                var svr = bot.servers.get("id", delta[key]);
                if(!svr) {
                    callback(true);
                    return;
                }
                bot.leaveServer(svr, function(err) {
                    if(err) {
                        logMsg(Date.now(), "ERROR", "General", null, "Failed to leave server " + svr.name);
                    }
                    callback(err);
                });
                break;
            case "clearstats":
                try {
                    clearServerStats(delta[key]);
                    callback();
                } catch(err) {
                    callback(err);
                }
                break;
            case "resetconfigs":
                try {
                    defaultConfig(bot.servers.get("id", delta[key]), true);
                    callback();
                } catch(err) {
                    callback(err);
                }
                break;
            case "points":
                var usr = bot.users.get("id", delta[key][0]);
                if(usr) {
                    if(!profileData[usr.id]) {
                        profileData[usr.id] = {
                            points: 0
                        }
                    }
                    profileData[usr.id].points = parseInt(delta[key][1]);
                    logMsg(Date.now(), "INFO", "General", null, "Maintainer set " + usr.username + "'s points to " + delta[key][1]);
                    callback();
                } else {
                    callback(true);
                }
                break;
            case "pmforward":
                if(typeof(delta[key])!="boolean") {
                    callback(true);
                    return;
                }
                logMsg(Date.now(), "INFO", "General", null, "Turned PM forwarding to maintainer " + (delta[key] ? "on" : "off"));
                configs.pmforward = delta[key];
                callback();
                break;
            case "status":
                bot.setStatus(delta[key], configs.game, function(err) {
                    if(err) {
                        logMsg(Date.now(), "ERROR", "General", null, "Failed to change status to " + delta[key]);
                    } else {
                        logMsg(Date.now(), "INFO", "General", null, "Changed bot status to " + delta[key]);
                    }
                    callback(err);
                });
                break;
            case "message":
                for(var i=0; i<bot.servers.length; i++) {
                    bot.sendMessage(bot.servers[i].defaultChannel, delta[key]);
                }
                logMsg(Date.now(), "INFO", "General", null, "Sent message \"" + delta[key] + "\" in every server");
                callback();
                break;
            case "clearlogs":
                logs.stream = [];
                logs.timestamp = Date.now();
                logMsg(Date.now(), "INFO", "General", null, "Cleared logs at maintainer's request");
                callback();
                break;
            case "extend":
                clearTimeout(onlineconsole[consoleid].timer);
                onlineconsole[consoleid].timer = setTimeout(function() {
                    logMsg(Date.now(), "INFO", "General", null, "Timeout on online maintainer console");
                    delete onlineconsole[consoleid];
                }, 300000);
                logMsg(Date.now(), "INFO", "General", null, "Extended maintainer console session");
                callback();
                return;
            case "logout":
                clearTimeout(onlineconsole[delta[key]].timer);
                delete onlineconsole[delta[key]];
                logMsg(Date.now(), "INFO", "General", null, "Logged out of online maintainer console");
                callback();
                break;
        }
    }
}

// Parse JSON data from POST for admin console
function parseAdminConfig(delta, svr, consoleid, callback) {
    var consoleusr = svr.members.get("id", consoleid);
    for(var key in delta) {
        switch(key) {
            case "nickname":
                var nick = delta[key];
                if(delta[key]==".") {
                    nick = bot.user.username;
                }
                bot.setNickname(svr, nick, bot.user, function(err) {
                    if(!err) {
                        logMsg(Date.now(), "INFO", svr.id, null, (nick!=bot.user.username ? ("Changed nickname to '" + nick + "'") : "Removed nickname") + " (@" + consoleusr.username + ")");
                    }
                    callback(err);
                });
                return;
            case "customkeys":
                if(Array.isArray(delta[key]) && delta[key].length==2 && ["google_api_key", "custom_search_id"].indexOf(delta[key][0])>-1) {
                    if(delta[key][1]=="default") {
                        configs.servers[svr.id].customkeys[delta[key][0]] = "";
                    } else {
                        configs.servers[svr.id].customkeys[delta[key][0]] = delta[key][1];
                    }
                } else {
                    callback(true);
                    return;
                }
                break;
            case "preset":
                delta[key] = delta[key].toLowerCase();
                if(configDefaults[delta[key]] && delta[key]!="default") {
                    for(var config in configDefaults[delta[key]]) {
                        configs.servers[svr.id][config] = JSON.parse(JSON.stringify(configDefaults[delta[key]][config]));
                    }
                    logMsg(Date.now(), "INFO", svr.id, null, "Applied config preset " + delta[key] + " for server (@" + consoleusr.username + ")");
                } else if(delta[key]=="default") {
                    defaultConfig(svr, true);
                    logMsg(Date.now(), "INFO", svr.id, null, "Reset configs for server (@" + consoleusr.username + ")");
                } else {
                    callback(true);
                    return;
                }
                break;
            case "listing":
                if(typeof(delta[key])=="boolean") {
                    if(!delta[key]) {
                        configs.servers[svr.id].listing.enabled = delta[key];
                        logMsg(Date.now(), "INFO", svr.id, null, "Disabled server listing (@" + consoleusr.username + ")");
                    } else {
                        bot.createInvite(svr.defaultChannel, {
                            maxAge: 0
                        }, function(err, invite) {
                            if(err) {
                                logMsg(Date.now(), "ERROR", svr.id, null, "Failed to create server listing invite (@" + consoleusr.username + ")");
                                callback(true);
                            } else {
                                configs.servers[svr.id].listing.invite = "https://discord.gg/" + invite.code;
                                configs.servers[svr.id].listing.enabled = delta[key];
                                if(!configs.servers[svr.id].listing.description) {
                                    configs.servers[svr.id].listing.description = svr.defaultChannel.topic;
                                }
                                logMsg(Date.now(), "INFO", svr.id, null, "Enabled server listing (@" + consoleusr.username + ")");
                                callback();
                            }
                        });
                        return;
                    }
                } else {
                    if(delta[key].length>1000) {
                        callback(true);
                        return;
                    }
                    logMsg(Date.now(), "INFO", svr.id, null, "Set server listing description to '" + delta[key].replace(/<\/?[^>]+(>|$)/g, "") + "' (@" + consoleusr.username + ")");
                    configs.servers[svr.id].listing.description = delta[key].replace(/<\/?[^>]+(>|$)/g, "");
                }
                break;
            case "admins":
            case "blocked":
                if(isNaN(delta[key])) {
                    var role = svr.roles.get("id", delta[key].substring(5));
                    if(role) {
                        var users = svr.usersWithRole(role);
                        for(var i=0; i<users.length; i++) {
                            if(configs.servers[svr.id][key].indexOf(users[i].id)==-1 && configs.servers[svr.id][key=="admins" ? "blocked" : "admins"].indexOf(users[i].id)==-1) {
                                configs.servers[svr.id][key].push(users[i].id);
                            }
                        }
                        logMsg(Date.now(), "INFO", svr.id, null, "Added role " + role.name + " to " + key + " list (@" + consoleusr.username + ")");
                    } else {
                        callback(true);
                        return;
                    }
                } else {
                    var usr = svr.members.get("id", delta[key]);
                    if(usr) {
                        if(configs.servers[svr.id][key].indexOf(usr.id)>-1) {
                            if(key=="admins" && (usr.id==consoleid || usr.id==svr.owner.id || (usr.id==configs.maintainer && consoleid!=configs.maintainer))) {
                                callback(true);
                                return;
                            }
                            logMsg(Date.now(), "INFO", svr.id, null, "Removed " + usr.username + " from " + key + " list (@" + consoleusr.username + ")");
                            configs.servers[svr.id][key].splice(configs.servers[svr.id][key].indexOf(usr.id), 1);
                        } else {
                            if(key=="blocked" && (usr.id==consoleid || usr.id==svr.owner.id || (usr.id==configs.maintainer && consoleid!=configs.maintainer))) {
                                callback(true);
                                return;
                            } else if(key=="admins" && stats[svr.id].members[usr.id]) {
                                stats[svr.id].members[usr.id].strikes = [];
                            }
                            logMsg(Date.now(), "INFO", svr.id, null, "Added " + usr.username + " to " + key + " list (@" + consoleusr.username + ")");
                            configs.servers[svr.id][key].push(usr.id);
                        }
                    } else {
                        callback(true);
                        return;
                    }
                }
                break;
            case "tags":
                if(!Array.isArray(delta[key]) || delta[key].length>3) {
                    callback(true);
                    return;
                }
                if(delta[key].length==1 && typeof(delta[key][0])=="string" && configs.servers[svr.id].tags[delta[key][0]]) {
                    delete configs.servers[svr.id].tags[delta[key][0]];
                    if(configs.servers[svr.id].tagcommands.indexOf(delta[key][0])>-1) {
                        configs.servers[svr.id].tagcommands.splice(configs.servers[svr.id].tagcommands.indexOf(delta[key][0]), 1);
                    }
                    if(configs.servers[svr.id].lockedtags.indexOf(delta[key][0])>-1) {
                        configs.servers[svr.id].lockedtags.splice(configs.servers[svr.id].lockedtags.indexOf(delta[key][0]), 1);
                    }
                    logMsg(Date.now(), "INFO", svr.id, null, "Deleted tag '" + delta[key][0] + "' (@" + consoleusr.username + ")");
                } else if(delta[key].length==2 && delta[key][0]=="lock" && typeof(delta[key][1])=="string" && configs.servers[svr.id].tags[delta[key][1]]) {
                    if(configs.servers[svr.id].lockedtags.indexOf(delta[key][1])==-1) {
                        var action = "Locked";
                        configs.servers[svr.id].lockedtags.push(delta[key][1]);
                    } else {
                        var action = "Unlocked";
                        configs.servers[svr.id].lockedtags.splice(configs.servers[svr.id].lockedtags.indexOf(delta[key][1]), 1);
                    }
                    logMsg(Date.now(), "INFO", svr.id, null, action + " tag '" + key + "' (@" + consoleusr.username + ")");
                } else if(delta[key].length==3 && typeof(delta[key][0])=="string" && !configs.servers[svr.id].tags[delta[key][0].toLowerCase().trim()] && typeof(delta[key][1])=="string" && delta[key][1].length<=1900 && ["text", "command"].indexOf(delta[key][2])>-1 && (delta[key][2]=="text" || !checkCommandConflicts(delta[key][0].toLowerCase().trim(), svr))) {
                    if(delta[key][2]=="command") {
                        configs.servers[svr.id].tagcommands.push(delta[key][0].toLowerCase().trim());
                    }
                    configs.servers[svr.id].tags[delta[key][0].toLowerCase().trim()] = delta[key][1];
                    logMsg(Date.now(), "INFO", svr.id, null, "Set new tag '" + delta[key][0].toLowerCase().trim() + "' (@" + consoleusr.username + ")");
                } else {
                    callback(true);
                    return;
                }
                break;
            case "translated":
                if(!Array.isArray(delta[key])) {
                    callback(true);
                    return;
                } else {
                    var usr = svr.members.get("id", delta[key][0]);
                    if(usr) {
                        if(configs.servers[svr.id][key].list.indexOf(usr.id)>-1) {
                            logMsg(Date.now(), "INFO", svr.id, null, "Removed " + usr.username + " from " + key + " list (@" + consoleusr.username + ")");
                            configs.servers[svr.id][key].list.splice(configs.servers[svr.id][key].list.indexOf(usr.id), 1);
                            configs.servers[svr.id][key].langs.splice(configs.servers[svr.id][key].list.indexOf(usr.id), 1);
                            configs.servers[svr.id][key].channels.splice(configs.servers[svr.id][key].list.indexOf(usr.id), 1);
                        } else if(delta[key][1] && delta[key][2] && Array.isArray(delta[key][2])) {
                            logMsg(Date.now(), "INFO", svr.id, null, "Added " + usr.username + " to " + key + " list (@" + consoleusr.username + ")");
                            configs.servers[svr.id][key].list.push(usr.id);
                            configs.servers[svr.id][key].langs.push(delta[key][1]);
                            configs.servers[svr.id][key].channels.push(delta[key][2]);
                        } else {
                            callback(true);
                            return;
                        }
                    } else {
                        callback(true);
                        return;
                    }
                }
                break;
            case "mute":
                if(!Array.isArray(delta[key]) || delta[key].length!=2 || isNaN(delta[key][0]) || (isNaN(delta[key][1]) && delta[key][1]!="all")) {
                    callback(true);
                } else {
                    var usr = svr.members.get("id", delta[key][0]);
                    if(usr) {
                        if(delta[key][1]=="all") {
                            var muteInChannel = function(i) {
                                if(i>=svr.channels.length) {
                                    logMsg(Date.now(), "INFO", svr.id, null, "Toggled mute for " + usr.username + " in all channels (@" + consoleusr.username + ")");
                                    callback();
                                    return;
                                }
                                if(svr.channels[i] instanceof Discord.VoiceChannel) {
                                    muteInChannel(++i);
                                    return;
                                }
                                muteUser(svr.channels[i], usr, function(err) {
                                    if(err) {
                                        callback(err);
                                    } else {
                                        muteInChannel(++i);
                                    }
                                });
                            };
                            muteInChannel(0);
                        } else {
                            var ch = svr.channels.get("id", delta[key][1]);
                            muteUser(ch, usr, function(err) {
                                if(!err) {
                                    logMsg(Date.now(), "INFO", svr.id, ch.id, "Toggled mute for " + usr.username + " (@" + consoleusr.username + ")");
                                }
                                callback(err);
                            });
                        }
                    } else {
                        callback(true);
                    }
                }
                return;
            case "strikes":
                if(Array.isArray(delta[key]) && delta[key].length==2) {
                    var usr = svr.members.get("id", delta[key][0]);
                    if(usr) {
                        if(!isNaN(delta[key][1])) {
                            if(stats[svr.id].members[usr.id]) {
                                if(delta[key][1]<stats[svr.id].members[usr.id].strikes.length && delta[key][1]>=0) {
                                    if(["First-time spam violation", "First-time filter violation"].indexOf(stats[svr.id].members[usr.id].strikes[delta[key][1]][1])>-1 && stats[svr.id].members[usr.id].strikes[delta[key][1]][0]=="Automatic") {
                                        if(configs.servers[svr.id].points && profileData[usr.id].points) {
                                            profileData[usr.id].points += 50;
                                        }
                                    } else if(["Second-time spam violation", "Second-time filter violation"].indexOf(stats[svr.id].members[usr.id].strikes[delta[key][1]][1])>-1 && stats[svr.id].members[usr.id].strikes[delta[key][1]][0]=="Automatic") {
                                        if(configs.servers[svr.id].points && profileData[usr.id].points) {
                                            profileData[usr.id].points += 100;
                                        }
                                        if(configs.servers[svr.id].blocked.indexOf(usr.id)>-1) {
                                            configs.servers[svr.id].blocked.splice(configs.servers[svr.id].blocked.indexOf(usr.id), 1);
                                        }
                                    }

                                    stats[svr.id].members[usr.id].strikes.splice(delta[key][1], 1);
                                    logMsg(Date.now(), "INFO", svr.id, null, "Removed strike for " + usr.username + " (@" + consoleusr.username + ")");
                                } else if(delta[key][1]==-1) {
                                    stats[svr.id].members[usr.id].strikes = [];
                                    logMsg(Date.now(), "INFO", svr.id, null, "Cleared strikes for " + usr.username + " (@" + consoleusr.username + ")");
                                } else {
                                    callback(true);
                                    return;
                                }
                            } else {
                                callback(true);
                                return;
                            }
                        } else {
                            if(delta[key][1].length>200) {
                                callback(true);
                                return;
                            }
                            checkStats(usr.id, svr.id);
                            stats[svr.id].members[usr.id].strikes.push([consoleid, delta[key][1], Date.now()]);
                            logMsg(Date.now(), "INFO", svr.id, null, "Strike for " + usr.username + " (@" + consoleusr.username + ")");
                        }
                    } else {
                        callback(true);
                        return;
                    }
                } else {
                    callback(true);
                    return;
                }
                break;
            case "customroles":
            case "spamfilter":
            case "nsfwfilter":
                if(typeof(delta[key])=="boolean") {
                    configs.servers[svr.id][key][0] = delta[key];
                    var yn = delta[key] ? "on" : "off";
                    logMsg(Date.now(), "INFO", svr.id, null, "Turned " + key + " " + yn + " (@" + consoleusr.username + ")");
                } else if(!isNaN(delta[key]) && key!="customroles") {
                    var ch = svr.channels.get("id", delta[key]);
                    if(!ch) {
                        callback(true);
                        return;
                    }
                    if(configs.servers[svr.id][key][1].indexOf(ch.id)>-1) {
                        configs.servers[svr.id][key][1].splice(configs.servers[svr.id][key][1].indexOf(ch.id), 1);
                        var yn = "on";
                    } else{
                        configs.servers[svr.id][key][1].push(ch.id);
                        var yn = "off";
                    }
                    logMsg(Date.now(), "INFO", svr.id, null, "Turned " + key + " " + yn + " in " + ch.name + ", (@" + consoleusr.username + ")");
                } else if(!isNaN(delta[key]) && key=="customroles") {
                    var role = svr.roles.get("id", delta[key]);
                    if(!role) {
                        callback(true);
                        return;
                    }
                    if(configs.servers[svr.id][key][1].indexOf(role.id)>-1) {
                        configs.servers[svr.id][key][1].splice(configs.servers[svr.id][key][1].indexOf(role.id), 1);
                        var yn = ["Removed", "from"];
                        if(configs.servers[svr.id][key][1].length==0) {
                            configs.servers[svr.id][key][0] = false;
                        }
                    } else {
                        configs.servers[svr.id][key][1].push(role.id);
                        var yn = ["Added", "to"];
                    }
                    logMsg(Date.now(), "INFO", svr.id, null, yn[0] + " " + role.name + " " + yn[1] + " " + key + " list (@" + consoleusr.username + ")");
                } else if(delta[key]=="custom" && key=="customroles") {
                    configs.servers[svr.id][key][2] = !configs.servers[svr.id][key][2];
                    var yn = configs.servers[svr.id][key][2] ? "on" : "off";
                    logMsg(Date.now(), "INFO", svr.id, null, "Turned custom for " + key + " " + yn + " (@" + consoleusr.username + ")");
                } else if(["spamfilter", "nsfwfilter"].indexOf(key)>-1 && delta[key].toLowerCase().indexOf("action-")==0 && ["action-kick", "action-block", "action-mute"].indexOf(delta[key].toLowerCase())>-1) {
                    if(key=="spamfilter") {
                        configs.servers[svr.id][key][3] = delta[key].toLowerCase().substring(delta[key].indexOf("-")+1);
                    } else if(key=="nsfwfilter") {
                        configs.servers[svr.id][key][2] = delta[key].toLowerCase().substring(delta[key].indexOf("-")+1);
                    }
                    logMsg(Date.now(), "INFO", svr.id, null, "Set " + key + " action to " + delta[key].toLowerCase().substring(delta[key].indexOf("-")+1) + " (@" + consoleusr.username + ")");
                } else if(["spamfilter", "nsfwfilter"].indexOf(key)>-1 && delta[key].toLowerCase().indexOf("role-")==0) {
                    var role = svr.roles.get("id", delta[key].substring(delta[key].indexOf("-")+1));
                    if(delta[key].length==5) {
                        role = {id: "", name: "none"};
                    }
                    if(role) {
                        if(key=="spamfilter") {
                            configs.servers[svr.id][key][4] = role.id;
                        } else if(key=="nsfwfilter") {
                            configs.servers[svr.id][key][3] = role.id;
                        }
                        logMsg(Date.now(), "INFO", svr.id, null, "Set " + key + " role to " + role.name + " (@" + consoleusr.username + ")");
                    } else {
                        callback(true);
                        return;
                    }
                } else if(["spamfilter", "nsfwfilter"].indexOf(key)>-1 && delta[key].toLowerCase()=="delete") {
                    if(key=="spamfilter") {
                        configs.servers[svr.id][key][5] = !configs.servers[svr.id][key][5];
                        var yn = configs.servers[svr.id][key][5] ? "on" : "off";
                    } else if(key=="nsfwfilter") {
                        configs.servers[svr.id][key][4] = !configs.servers[svr.id][key][4];
                        var yn = configs.servers[svr.id][key][4] ? "on" : "off";
                    }
                    logMsg(Date.now(), "INFO", svr.id, null, "Turned deleting messages " + yn + " for " + key + " (@" + consoleusr.username + ")");
                } else if(key=="spamfilter") {
                    if(["high", "medium", "low"].indexOf(delta[key].toLowerCase())==-1) {
                        callback(true);
                        return;
                    }
                    switch(delta[key]) {
                        case "high":
                            configs.servers[svr.id][key][2] = 3;
                            break;
                        case "medium":
                            configs.servers[svr.id][key][2] = 5;
                            break;
                        case "low":
                            configs.servers[svr.id][key][2] = 10;
                            break;
                    }
                    logMsg(Date.now(), "INFO", svr.id, null, key + " sensitivity set to " + delta[key] + " (@" + consoleusr.username + ")");
                } else {
                    callback(true);
                    return;
                }
                break;
            case "voicetext": 
                if(isNaN(delta[key]) || !svr.channels.get("id", delta[key]) || svr.channels.get("id", delta[key]).type!="voice") {
                    callback(true);
                    return;
                }
                if(configs.servers[svr.id][key].indexOf(delta[key])>-1) {
                    configs.servers[svr.id][key].splice(configs.servers[svr.id][key].indexOf(delta[key]), 1);
                    logMsg(Date.now(), "INFO", svr.id, null, "Removed " + svr.channels.get("id", delta[key]).name + " from " + key + " list (@" + consoleusr.username + ")");
                } else {
                    configs.servers[svr.id][key].push(delta[key]);
                    logMsg(Date.now(), "INFO", svr.id, null, "Added " + svr.channels.get("id", delta[key]).name + " to " + key + " list (@" + consoleusr.username + ")");
                }
                break;
            case "rss":
                if(typeof(delta[key])=="boolean") {
                    configs.servers[svr.id][key][0] = delta[key];
                    var yn = delta[key] ? "on" : "off";
                    logMsg(Date.now(), "INFO", svr.id, null, "Command " + key + " turned " + yn + " (@" + consoleusr.username + ")");
                } else if(typeof(delta[key])=="object" && delta[key].chid && !isNaN(delta[key].chid) && !isNaN(delta[key].i) && delta[key].i>=0 && delta[key].i<configs.servers[svr.id].rss[1].length) {
                    var ch = svr.channels.get("id", delta[key].chid);
                    if(ch) {
                        if(configs.servers[svr.id].rss[3][delta[key].i][0].indexOf(delta[key].chid)==-1) {
                            var yn = "added to";
                            configs.servers[svr.id].rss[3][delta[key].i][0].push(delta[key].chid);
                        } else {
                            var yn = "removed from";
                            configs.servers[svr.id].rss[3][delta[key].i][0].splice(configs.servers[svr.id].rss[3][delta[key].i][0].indexOf(delta[key].chid), 1);
                        }
                        logMsg(Date.now(), "INFO", svr.id, null, ch.name + " " + yn + " rss updates list for " + configs.servers[svr.id].rss[2][delta[key].i] + " (@" + consoleusr.username + ")");
                    } else {
                        callback(true);
                        return;
                    }
                } else if(!Array.isArray(delta[key])) {
                    if(configs.servers[svr.id].rss[2][delta[key]]) {
                        configs.servers[svr.id].rss[1].splice(delta[key], 1);
                        configs.servers[svr.id].rss[2].splice(delta[key], 1);
                        configs.servers[svr.id].rss[3].splice(delta[key], 1);
                        logMsg(Date.now(), "INFO", svr.id, null, "Feed " + configs.servers[svr.id].rss[2][delta[key]] + " removed (@" + consoleusr.username + ")");
                    } else {
                        callback(true);
                        return;
                    }
                } else {
                    if(configs.servers[svr.id].rss[2].indexOf(delta[key][1])==-1 && configs.servers[svr.id].rss[1].indexOf(delta[key][0])==-1 && (/(http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/).test(delta[key][0])) {
                        configs.servers[svr.id].rss[1].push(delta[key][0]);
                        configs.servers[svr.id].rss[2].push(delta[key][1].toLowerCase());
                        configs.servers[svr.id].rss[3].push([[],""]);
                        logMsg(Date.now(), "INFO", svr.id, null, "Feed " + delta[key][1] + " added (@" + consoleusr.username + ")");
                    } else {
                        callback(true);
                        return;
                    }
                }
                break;
            case "cmdtag":
                if(["tag", "+", "&", "!", "-", "--", "/", "$", ">", "`", "~", "*", "=", "\\", "'"].indexOf(delta[key])>-1) {
                    configs.servers[svr.id].cmdtag = delta[key];
                    logMsg(Date.now(), "INFO", svr.id, null, "Changed " + key + " to '" + delta[key] + "' (@" + consoleusr.username + ")");
                } else {
                    callback(true);
                    return;
                }
                break;
            case "newgreeting":
            case "rmgreeting":
                if(delta[key].length>1500) {
                    callback(true);
                    return;
                }
                logMsg(Date.now(), "INFO", svr.id, null, "Set " + key + " to '" + delta[key] + "' (@" + consoleusr.username + ")");
                configs.servers[svr.id][key] = delta[key];
                break;
            case "motd":
                if(typeof(delta[key])=="string" && delta[key].indexOf("time-")==0 && delta[key].length>5) {
                    var time = parseTime(delta[key].slice(5));
                    if(time) {
                        configs.servers[svr.id][key][1] = time.countdown / 1000;
                        configs.servers[svr.id][key][3] = time.num + " " + time.time;
                        logMsg(Date.now(), "INFO", svr.id, null, "Set " + key + " interval to " + time.num + " " + time.time + " (@" + consoleusr.username + ")");
                    } else {
                        callback(true);
                        return;
                    }
                } else if(typeof(delta[key])=="string" && delta[key].length<2000 && (delta[key]=="" || isNaN(delta[key]))) {
                    var startMotd = false;
                    if(!configs.servers[svr.id][key][0]) {
                        startMotd = true;
                    }
                    configs.servers[svr.id][key][0] = delta[key];
                    logMsg(Date.now(), "INFO", svr.id, null, "Changed " + key + " to '" + delta[key] + "' (@" + consoleusr.username + ")");
                    if(startMotd) {
                        sendMotd(svr);
                    }
                } else if(!isNaN(delta[key])) {
                    var ch = svr.channels.get("id", delta[key]);
                    if(ch) {
                        configs.servers[svr.id][key][2] = ch.id;
                    } else {
                        callback(true);
                        return;
                    }
                } else {
                    callback(true);
                    return;
                }
                break;
            case "statsexclude":
                if(!Array.isArray(delta[key])) {
                    callback(true);
                    return;
                }
                var statschannels = [];
                for(var i=0; i<svr.channels.length; i++) {
                    if(!(svr.channels[i] instanceof Discord.VoiceChannel) && delta[key].indexOf(svr.channels[i].id)==-1) {
                        statschannels.push(svr.channels[i].id);
                    }
                }
                configs.servers[svr.id].statsexclude = statschannels;
                logMsg(Date.now(), "INFO", svr.id, null, "Message activity logging channels set (@" + consoleusr.username + ")");
                break;
            case "rankslist":
                if(!isNaN(delta[key]) && delta[key]>=0 && delta[key]<configs.servers[svr.id].rankslist.length && configs.servers[svr.id].rankslist.length>1) {
                    var removedRank = configs.servers[svr.id].rankslist.splice(delta[key], 1);
                    logMsg(Date.now(), "INFO", svr.id, null, "Removed rank " + removedRank.name + " with max " + removedRank.max + " (@" + consoleusr.username + ")");
                } else if(typeof(delta[key])=="object" && Object.keys(delta[key]).length==3 && delta[key].name && delta[key].max && !isNaN(delta[key].max) && delta[key].max>0 && (delta[key].role==null || svr.roles.get("id", delta[key].role))) {
                    for(var i=0; i<configs.servers[svr.id].rankslist.length; i++) {
                        if(delta[key].name==configs.servers[svr.id].rankslist[i].name || delta[key].max==configs.servers[svr.id].rankslist[i].max) {
                            callback(true);
                            return;
                        }
                        if(delta[key].max<=configs.servers[svr.id].rankslist[i].max) {
                            configs.servers[svr.id].rankslist.splice(i, 0, delta[key]);
                            logMsg(Date.now(), "INFO", svr.id, null, "Added rank " + delta[key].name + " with max " + delta[key].max + " (@" + consoleusr.username + ")");
                            break;
                        } else if(i==configs.servers[svr.id].rankslist.length-1) {
                            configs.servers[svr.id].rankslist.splice(i+1, 0, delta[key]);
                            logMsg(Date.now(), "INFO", svr.id, null, "Added rank " + delta[key].name + " with max " + delta[key].max + " (@" + consoleusr.username + ")");
                            break;
                        }
                    }
                }
                break;
            case "cooldown":
            case "defaultcount":
            case "maxcount":
                if(isNaN(delta[key]) || (["defaultcount", "maxcount"].indexOf(key)>-1 && (delta[key]>100 || delta[key]<1)) || (key=="cooldown" && delta[key]>300000)) {
                    callback(true);
                    return;
                }
                configs.servers[svr.id][key] = parseInt(delta[key]);
                logMsg(Date.now(), "INFO", svr.id, null, key + " set to " + delta[key] + " (@" + consoleusr.username + ")");
                break;
            case "newrole":
                var newroles = [];
                if(delta[key]) {
                    for(var i=0; i<delta[key].length; i++) {
                        var role = svr.roles.get("id", delta[key][i]);
                        if(role && newroles.indexOf(role.id)==-1) {
                            newroles.push(role.id);
                        }
                    }
                }
                configs.servers[svr.id][key] = newroles;
                logMsg(Date.now(), "INFO", svr.id, null, "Set " + newroles.length + " " + key + (newroles.length==1 ? "" : "s") + " (@" + consoleusr.username + ")");
                break;
            case "newmembermsg":
            case "onmembermsg":
            case "offmembermsg":
            case "rmmembermsg":
            case "banmembermsg":
            case "unbanmembermsg":
                if(typeof(delta[key])=="boolean") {
                    configs.servers[svr.id][key][0] = delta[key];
                    var yn = delta[key] ? "on" : "off";
                    logMsg(Date.now(), "INFO", svr.id, null, key + " turned " + yn + " (@" + consoleusr.username + ")");
                    if(!configs.servers[svr.id][key][2]) {
                        configs.servers[svr.id][key][2] = svr.defaultChannel.id;
                    }
                } else if(!isNaN(delta[key])) {
                    var ch = svr.channels.get("id", delta[key]);
                    if(!ch) {
                        callback(true);
                        return;
                    }
                    configs.servers[svr.id][key][2] = delta[key];
                    logMsg(Date.now(), "INFO", svr.id, null, "Set " + key + " channel to " + ch.name + " (@" + consoleusr.username + ")");
                } else if(typeof(delta[key])=="string") {
                    if(delta[key].toLowerCase()=="default") {
                        configs.servers[svr.id][key][1] = JSON.parse(JSON.stringify(configDefaults.default[key][1]));
                        logMsg(Date.now(), "INFO", svr.id, null, "Reset " + key + " to default (@" + consoleusr.username + ")");
                    } else if(configs.servers[svr.id][key][1].indexOf(delta[key])>-1) {
                        configs.servers[svr.id][key][1].splice(configs.servers[svr.id][key][1].indexOf(delta[key]), 1);
                        if(configs.servers[svr.id][key][1].length==0) {
                            configs.servers[svr.id][key][0] = false;
                            configs.servers[svr.id][key][1] = JSON.parse(JSON.stringify(configDefaults.default[key][1]));
                        }
                        logMsg(Date.now(), "INFO", svr.id, null, key + " '" + delta[key] + "' removed (@" + consoleusr.username + ")");
                    } else {
                        configs.servers[svr.id][key][1].push(delta[key]);
                        logMsg(Date.now(), "INFO", svr.id, null, key + " '" + delta[key] + "' added (@" + consoleusr.username + ")");
                    }
                } else {
                    callback(true);
                    return;
                }
                break;
            case "changemembermsg":
            case "rankmembermsg":
            case "twitchmembermsg":
            case "editmembermsg":
            case "deletemembermsg":
                if(typeof(delta[key])=="boolean") {
                    configs.servers[svr.id][key][0] = delta[key];
                    var yn = delta[key] ? "on" : "off";
                    logMsg(Date.now(), "INFO", svr.id, null, key + " turned " + yn + " (@" + consoleusr.username + ")");
                    if(["editmembermsg", "deletemembermsg"].indexOf(key)==-1 && !configs.servers[svr.id][key][1]) {
                        configs.servers[svr.id][key][1] = svr.defaultChannel.id;
                    }
                } else if(Array.isArray(delta[key]) && ["editmembermsg", "deletemembermsg"].indexOf(key)>-1) {
                    configs.servers[svr.id][key][1] = delta[key];
                    if(delta[key].length==0) {
                        configs.servers[svr.id][key][0] = false;
                    }
                    logMsg(Date.now(), "INFO", svr.id, null, "Set " + key + " channels (@" + consoleusr.username + ")");
                } else if(!isNaN(delta[key]) && ["editmembermsg", "deletemembermsg"].indexOf(key)==-1) {
                    var ch = svr.channels.get("id", delta[key]);
                    if(!ch) {
                        callback(true);
                        return;
                    }
                    configs.servers[svr.id][key][1] = delta[key];
                    logMsg(Date.now(), "INFO", svr.id, null, "Set " + key + " channel to " + ch.name + " (@" + consoleusr.username + ")");
                } else if(key=="rankmembermsg" && delta[key].toLowerCase()=="pm") {
                    configs.servers[svr.id][key][2] = !configs.servers[svr.id][key][2];
                    var yn = configs.servers[svr.id][key][2] ? "on" : "off";
                    logMsg(Date.now(), "INFO", svr.id, null, key + " PM turned " + yn + " (@" + consoleusr.username + ")");
                } else {
                    callback(true);
                    return;
                }
                break;
            case "filter":
                if(typeof(delta[key])=="string" && delta[key].toLowerCase().indexOf("action-")==0 && ["action-kick", "action-block", "action-mute"].indexOf(delta[key].toLowerCase())>-1) {
                    configs.servers[svr.id].filter[1] = delta[key].toLowerCase().substring(delta[key].indexOf("-")+1);
                    logMsg(Date.now(), "INFO", svr.id, null, "Set " + key + " action to " + delta[key].toLowerCase().substring(delta[key].indexOf("-")+1) + " (@" + consoleusr.username + ")");
                    break;
                } else if(typeof(delta[key])=="string" && delta[key].toLowerCase().indexOf("role-")==0) {
                    var role = svr.roles.get("id", delta[key].substring(delta[key].indexOf("-")+1));
                    if(delta[key].length==5) {
                        role = {id: "", name: "none"};
                    }
                    if(role) {
                        configs.servers[svr.id][key][2] = role.id;
                        logMsg(Date.now(), "INFO", svr.id, null, "Set " + key + " role to " + role.name + " (@" + consoleusr.username + ")");
                    } else {
                        callback(true);
                        return;
                    }
                    break;
                } else if(typeof(delta[key])=="string" && delta[key].toLowerCase()=="delete") {
                    configs.servers[svr.id][key][3] = !configs.servers[svr.id][key][3];
                    var yn = configs.servers[svr.id][key][3] ? "on" : "off";
                    logMsg(Date.now(), "INFO", svr.id, null, "Turned deleting messages " + yn + " for " + key + " (@" + consoleusr.username + ")");
                    break;
                }
                if(!Array.isArray(delta[key])) {
                    callback(true);
                    return;
                }
                logMsg(Date.now(), "INFO", svr.id, null, "Set " + key + " to '" + delta[key] + "' (@" + consoleusr.username + ")");
                configs.servers[svr.id][key][0] = delta[key];
                break;
            case "closepoll":
                try {
                    var ch = svr.channels.get("id", polls[delta[key]].channel);
                    bot.sendMessage(ch, "The ongoing poll in this channel has been closed by an admin.");
                    bot.sendMessage(ch, pollResults(delta[key], "The results are in", "and the winner is"));
                    logMsg(Date.now(), "INFO", svr.id, null, "Closed active poll in " + ch.name + ", (@" + consoleusr.username + ")");
                    delete polls[delta[key]];
                    saveData("./data/polls.json", callback);
                } catch(err) {
                    callback(err);
                }
                return;
            case "endtrivia":
                try {
                    var ch = svr.channels.get("id", delta[key]);
                    bot.sendMessage(ch, "Sorry to interrupt your game, but an admin has closed this trivia session.", function() {
                        bot.sendMessage(msg.channel, endTrivia(stats[svr.id].trivia[ch.id], ch.server, true));
                    });
                    logMsg(Date.now(), "INFO", svr.id, null, "Closed trivia game in " + ch.name + ", (@" + consoleusr.username + ")");
                    delete stats[svr.id].trivia[ch.id];
                    callback();
                } catch(err) {
                    callback(err);
                }
                return;
            case "endgiveaway":
                try {
                    var ch = svr.channels.get("id", giveaways[delta[key]].channel);
                    logMsg(Date.now(), "INFO", svr.id, null, "Closed giveaway in " + ch.name + ", (@" + consoleusr.username + ")");
                    bot.sendMessage(ch, "The giveaway `" + giveaways[delta[key]].name + "` started by " + svr.members.get("id", delta[key]) + " has been closed by an admin.");
                    delete giveaways[delta[key]];
                    saveData("./data/giveaways.json", callback);
                } catch(err) {
                    callback(err);
                }
                return;
            case "autoprune":
                if(typeof(delta[key])=="boolean") {
                    configs.servers[svr.id].autoprune[0] = delta[key];
                } else if(!isNaN(delta[key]) && delta[key]>300) {
                    configs.servers[svr.id].autoprune[1] = parseInt(delta[key]);
                } else {
                    callback(true);
                    return;
                }
                break;
            case "clean":
            case "purge":
                var ch = svr.channels.get("id", delta[key][0]);
                if(ch && !isNaN(delta[key][1])) {
                    logMsg(Date.now(), "INFO", svr.id, ch.id, "Request to " + key + " " + delta[key][1] + " messages (@" + consoleusr.username + ")");
                    cleanMessages(ch, key=="purge" ? null : bot.user, delta[key][1], callback);
                } else {
                    callback(true);
                }
                return;
            case "triviasets":
            case "extensions":
                if(typeof delta[key]=="string") {
                    delta[key] = decodeURI(delta[key]);
                    if(configs.servers[svr.id][key][delta[key]]) {
                        delete configs.servers[svr.id][key][delta[key]];
                        logMsg(Date.now(), "INFO", svr.id, null, "Deleted " + key + " " + delta[key] + " (@" + consoleusr.username + ")");
                        break;
                    } else {
                        callback(true);
                        return;
                    }
                } else {
                    if(key=="triviasets") {
                        addTriviaSet(delta[key], svr, consoleid, callback);
                    }
                    return;
                }
            case "admincommands":
                if(!commands[delta[key]] && ["chatterbot", "tagreaction", "poll"].indexOf(delta[key])==-1 && delta[key]=="vote") {
                    callback(true);
                    return;
                }
                if(configs.servers[svr.id].admincommands.indexOf(delta[key])==-1) {
                    configs.servers[svr.id].admincommands.push(delta[key]);
                    if(delta[key]=="poll") {
                        configs.servers[svr.id].admincommands.push("vote");
                    }
                    logMsg(Date.now(), "INFO", svr.id, null, "Added " + delta[key] + " to " + key + " list (@" + consoleusr.username + ")");
                } else {
                    configs.servers[svr.id].admincommands.splice(configs.servers[svr.id].admincommands.indexOf(delta[key]), 1);
                    if(delta[key]=="poll") {
                        configs.servers[svr.id].admincommands.splice(configs.servers[svr.id].admincommands.indexOf("vote"), 1);
                    }
                    logMsg(Date.now(), "INFO", svr.id, null, "Removed " + delta[key] + " from " + key + " list (@" + consoleusr.username + ")");
                }
                break;
            case "chrestrict":
                if(!Array.isArray(delta[key]) || delta[key].length!=2 || typeof(delta[key][0])!="string" || (!commands[delta[key][0]] && ["chatterbot", "tagreaction", "poll"].indexOf(delta[key][0])==-1 && delta[key][0]=="vote") || !Array.isArray(delta[key][1])) {
                    callback(true);
                    return;
                }
                for(var i=0; i<svr.channels.length; i++) {
                    if(!(svr.channels[i] instanceof Discord.VoiceChannel)) {
                        if(delta[key][1].indexOf(svr.channels[i].id)==-1) {
                            if(!configs.servers[svr.id][key][svr.channels[i].id]) {
                                configs.servers[svr.id][key][svr.channels[i].id] = [];
                            }
                            if(configs.servers[svr.id][key][svr.channels[i].id].indexOf(delta[key][0])==-1) {
                                configs.servers[svr.id][key][svr.channels[i].id].push(delta[key][0]);
                                if(delta[key][0]=="poll") {
                                    configs.servers[svr.id][key][svr.channels[i].id].push("vote");
                                }
                                logMsg(Date.now(), "INFO", svr.id, null, "Command " + delta[key][0] + " turned off in " + svr.channels[i].name + " (@" + consoleusr.username + ")");
                            }
                        } else {
                            if(configs.servers[svr.id][key][svr.channels[i].id] && configs.servers[svr.id][key][svr.channels[i].id].indexOf(delta[key][0])>-1) {
                                configs.servers[svr.id][key][svr.channels[i].id].splice(configs.servers[svr.id][key][svr.channels[i].id].indexOf(delta[key][0]), 1);
                                if(delta[key][0]=="poll") {
                                    configs.servers[svr.id][key][svr.channels[i].id].splice(configs.servers[svr.id][key][svr.channels[i].id].indexOf("vote"), 1);
                                }
                                logMsg(Date.now(), "INFO", svr.id, null, "Command " + delta[key][0] + " turned on in " + svr.channels[i].name + " (@" + consoleusr.username + ")");
                                if(configs.servers[svr.id][key][svr.channels[i].id].length==0) {
                                    delete configs.servers[svr.id][key][svr.channels[i].id];
                                }
                            }
                        }
                    }
                }
                break;
            case "leave":
                if(bot.servers.length>1) {
                    parseMaintainerConfig({rmserver: svr.id}, callback);
                } else {
                    callback(true);
                }
                return;
            case "extend":
                clearTimeout(onlineconsole[consoleid].timer);
                onlineconsole[consoleid].timer = setTimeout(function() {
                    logMsg(Date.now(), "INFO", svr.id, null, "Timeout on online admin console (@" + consoleusr.username + ")");
                    delete adminconsole[consoleid];
                    delete onlineconsole[consoleid];
                }, 300000);
                logMsg(Date.now(), "INFO", null, consoleid, "Extended admin console session for " + svr.name);
                callback();
                return;
            case "logout":
                clearTimeout(onlineconsole[consoleid].timer);
                delete adminconsole[consoleid];
                delete onlineconsole[consoleid];
                logMsg(Date.now(), "INFO", null, consoleid, "Logged out of online admin console for " + svr.name);
                callback();
                return;
            default:
                if(configs.servers[svr.id][key]!=null && typeof(configs.servers[svr.id][key])==typeof(delta[key])) {
                    configs.servers[svr.id][key] = delta[key];
                    var yn = delta[key] ? "on" : "off";
                    logMsg(Date.now(), "INFO", svr.id, null, key + " turned " + yn + " (@" + consoleusr.username + ")");
                } else {
                    callback(true);
                    return;
                }
                break;
        }
    }
    callback();
}

// Parses and applies new trivia set from admin console
function addTriviaSet(set, svr, consoleid, callback) {
    var consoleusr = svr.members.get("id", consoleid);
    if(consoleusr) {
        var validity;
        if(!set.name || !set.stream) {
            validity = "missing parameter(s)";
        } else if(!Array.isArray(set.stream)) {
            validity = "question set is not an array";
        } else if(set.stream.length==0) {
            validity = "no questions";
        } else if(configs.servers[svr.id].triviasets[set.name]) {
            validity = "set already exists";
        } else {
            var tset = [];
            for(var i=0; i<set.stream.length; i++) {
                if(!set.stream[i].category || !set.stream[i].question || !set.stream[i].answer) {
                    validity = "error at question  " + i;
                    break;
                } else {
                    tset.push(set.stream[i]);
                }
            }

            if(validity) {
                logMsg(Date.now(), "WARN", svr.id, null, "Trivia set uploaded is invalid (@" + consoleusr.username + "): " +  validity);
                callback(validity);
            } else {
                configs.servers[svr.id].triviasets[set.name] = tset;
                logMsg(Date.now(), "INFO", svr.id, null, "Trivia set " + set.name + " added to server (@" + consoleusr.username + ")");
                callback();
            }
        }
    } else {
        callback(true);
    }
}

// Checks if a user is muted and in which channels
function checkUserMute(usr, svr) {
    var mutelist = {};
    for(var i=0; i<svr.channels.length; i++) {
        if(!(svr.channels[i] instanceof Discord.VoiceChannel) && configs.servers[svr.id].muted[svr.channels[i].id]) {
            if(configs.servers[svr.id].muted[svr.channels[i].id].indexOf(usr.id)>-1) {
                mutelist[svr.channels[i].id] = true;
                continue;
            }
        }
        mutelist[svr.channels[i].id] = false;
    }
    return mutelist;
}

// Validiates and tests an extensions from admin console
function testExtension(data, svr, ch, consoleid, callback) {
    var consoleusr = svr.members.get("id", consoleid);
    if(consoleusr) {
        extensiontestlogs[svr.id] = [];
        validateExtension(data.extension, svr, function(valid) {
            if(valid) {
                extensiontestlogs[svr.id].push("INFO: Extension is valid");
                var params;
                switch(data.extension.type) {
                    case "command":
                        var cmd = checkCommandTag(data.message.content, svr.id);
                        if(cmd && cmd[0].toLowerCase()==data.extension.key.toLowerCase()) {
                            extensiontestlogs[svr.id].push("INFO: Treating test message as extension command");
                            params = getExtensionParams(data.extension, svr, ch, {
                                content: data.message.content,
                                cleanContent: data.message.cleanContent,
                                author: consoleusr,
                                attachments: []
                            }, null, cmd[1], true);
                        } else {
                            valid = false;
                            extensiontestlogs[svr.id].push("FATAL: No command match in test message");
                        }
                        break;
                    case "keyword":
                        var keywordcontains = contains(data.extension.key, data.message.content, data.extension.case);
                        if(keywordcontains>-1) {
                            extensiontestlogs[svr.id].push("INFO: Matched keyword in test message at index " + keywordcontains);
                            params = getExtensionParams(data.extension, svr, ch, {
                                content: data.message.content,
                                cleanContent: data.message.cleanContent,
                                author: consoleusr,
                                attachments: []
                            }, contains(data.extension.key, data.message.content, data.extension.case), null, true);
                        } else {
                            valid = false;
                            extensiontestlogs[svr.id].push("FATAL: No keyword match in test message");
                        }
                        break;
                    case "timer":
                        params = getExtensionParams(data.extension, svr, ch);
                        break;
                }
                if(params) {
                    extensiontestlogs[svr.id].push("INFO: Test-running extension in #" + ch.name + "...");
                    try {
                        var extDomain = domainRoot.create();
                        var sentResult = false;
                        extDomain.run(function() {
                            var context = new vm.createContext(params);
                            var script = new vm.Script(data.extension.process.replaceAll("<!--AWESOME_EXTENSION_NEWLINE-->", ""));
                            script.runInContext(context, {
                                displayErrors: true,
                                timeout: 10000
                            });
                            extensiontestlogs[svr.id].push("INFO: Extension executed successfully");
                            setTimeout(function() {
                                if(!sentResult) {
                                    callback(valid);
                                }
                            }, 10000);
                        });
                        extDomain.on("error", function(runError) {
                            if(extensiontestlogs[svr.id]) {
                                valid = false;
                                extensiontestlogs[svr.id].push(runError.stack.replaceAll(process.cwd(), "BOTPATH"));
                                extensiontestlogs[svr.id].push("ERROR: Failed to run extension, see above");
                                sentResult = true;
                                callback(valid);
                            }
                        });
                    } catch(runError) {
                        valid = false;
                        extensiontestlogs[svr.id].push(runError.stack.replaceAll(process.cwd(), "BOTPATH"));
                        extensiontestlogs[svr.id].push("ERROR: Failed to run extension, see above");
                        callback(valid);
                    }
                } else {
                    callback(valid);
                }
            } else {
                extensiontestlogs[svr.id].push("FATAL: Invalid extension properties, see above");
                callback(valid);
            }
        }, configs.servers[svr.id].extensions[data.extension.name]!=null);
    } else {
        callback();
    }
}

// Validates an extension from admin console
function validateExtension(extension, svr, callback, overridename) {
    extensiontestlogs[svr.id].push("INFO: Validating extension properties...");
    var isComplete = true;

    if(!extension.name) {
        isComplete = false;
        extensiontestlogs[svr.id].push("ERROR: Missing name value");
    } else if(typeof(extension.name)!="string") {
        isComplete = false;
        extensiontestlogs[svr.id].push("ERROR: Invalid name type, must be string");
    } else if(extension.name.length>200) {
        isComplete = false;
        extensiontestlogs[svr.id].push("ERROR: Name too long, cannot exceed 200 characters");
    } else if(configs.servers[svr.id].extensions[extension.name] && !overridename) {
        isComplete = false;
        extensiontestlogs[svr.id].push("ERROR: Extension name already registered");
    }

    if(!extension.channels) {
        isComplete = false;
        extensiontestlogs[svr.id].push("ERROR: Missing channels value");
    } else if(!Array.isArray(extension.channels)) {
        isComplete = false;
        extensiontestlogs[svr.id].push("ERROR: Invalid channels type, must be array");
    } else if(extension.channels.length>svr.channels.getAll("type", "text").length) {
        isComplete = false;
        extensiontestlogs[svr.id].push("ERROR: Too many channels");
    } else {
        for(var i=0; i<extension.channels.length; i++) {
            if(isNaN(extension.channels[i])) {
                isComplete = false;
                extensiontestlogs[svr.id].push("ERROR: Invalid type of channel at index " + i + ", must be Discord channel ID");
            } else if(!svr.channels.get("id", extension.channels[i])) {
                isComplete = false;
                extensiontestlogs[svr.id].push("ERROR: Invalid channel at index " + i + ", not found on server");
            } else if(extension.channels.lastIndexOf(extension.channels[i])!=i) {
                isComplete = false;
                extensiontestlogs[svr.id].push("ERROR: Duplicates entries of channel at index at " + i + " exist");
            }
        }
    }

    if(!extension.type) {
        isComplete = false;
        extensiontestlogs[svr.id].push("ERROR: Missing type value");
    } else if(typeof(extension.type)!="string") {
        isComplete = false;
        extensiontestlogs[svr.id].push("ERROR: Invalid type type, must be string");
    } else if(["command", "keyword", "timer"].indexOf(extension.type)==-1) {
        isComplete = false;
        extensiontestlogs[svr.id].push("ERROR: Invalid type value, must be \"command\", \"keyword\", or \"timer\"");
    }

    switch(extension.type) {
        case "command":
            if(!extension.key) {
                isComplete = false;
                extensiontestlogs[svr.id].push("ERROR: Missing command key value");
            } else if(typeof(extension.key)!="string") {
                isComplete = false;
                extensiontestlogs[svr.id].push("ERROR: Invalid command key type, must be string");
            } else if(extension.key.length>50) {
                isComplete = false;
                extensiontestlogs[svr.id].push("ERROR: Command key too long, must be 50 characters or less");
            } else if(extension.key.indexOf(" ")>-1) {
                isComplete = false;
                extensiontestlogs[svr.id].push("ERROR: Invalid command key value, cannot contain spaces");
            } else if(!(new RegExp("^[a-zA-Z0-9.]*$").test(extension.key))) {
                isComplete = false;
                extensiontestlogs[svr.id].push("ERROR: Invalid command key value, cannot contain special characters");
            } else if(checkCommandConflicts(extension.key, svr, overridename)) {
                isComplete = false;
                extensiontestlogs[svr.id].push("ERROR: Command key conflicts with existing command, extension command, or tag command");
            } else {
                extension.key = extension.key.toLowerCase().trim();
            }

            if(extension.usage==null) {
                isComplete = false;
                extensiontestlogs[svr.id].push("ERROR: Missing command usage value");
            } else if(typeof(extension.usage)!="string") {
                isComplete = false;
                extensiontestlogs[svr.id].push("ERROR: Invalid command usage type, must be string");
            } else if(extension.usage.length>150) {
                isComplete = false;
                extensiontestlogs[svr.id].push("ERROR: Command usage too long, must be 150 characters or less");
            }

            if(extension.extended==null) {
                isComplete = false;
                extensiontestlogs[svr.id].push("ERROR: Missing command extended help value");
            } else if(typeof(extension.extended)!="string") {
                isComplete = false;
                extensiontestlogs[svr.id].push("ERROR: Invalid command extended help type, must be string");
            } else if(extension.extended.length>500) {
                isComplete = false;
                extensiontestlogs[svr.id].push("ERROR: Command extended help too long, must be 500 characters or less");
            }

            if(Object.keys(extension).length!=7) {
                isComplete = false;
                extensiontestlogs[svr.id].push("ERROR: Extraneous extension properties exist");
            }
            break;
        case "keyword":
            if(!extension.key) {
                isComplete = false;
                extensiontestlogs[svr.id].push("ERROR: Missing keyword value");
            } else if(!Array.isArray(extension.key)) {
                isComplete = false;
                extensiontestlogs[svr.id].push("ERROR: Invalid keyword type, must be array");
            } else if(extension.key.length==0) {
                isComplete = false;
                extensiontestlogs[svr.id].push("ERROR: No keywords specified");
            } else {
                for(var i=0; i<extension.key.length; i++) {
                    if(!extension.key[i]) {
                        isComplete = false;
                        extensiontestlogs[svr.id].push("ERROR: Empty keyword at index " + i);
                    } else if(extension.key.lastIndexOf(extension.key[i])!=i) {
                        isComplete = false;
                        extensiontestlogs[svr.id].push("ERROR: Duplicates entries of keyword at index at " + i + " exist");
                    }
                }
            }

            if(extension.case==null) {
                isComplete = false;
                extensiontestlogs[svr.id].push("ERROR: Missing case sensitivity value");
            } else if(typeof(extension.case)!="boolean") {
                isComplete = false;
                extensiontestlogs[svr.id].push("ERROR: Invalid case sensitivity type, must be boolean");
            }

            if(Object.keys(extension).length!=6) {
                isComplete = false;
                extensiontestlogs[svr.id].push("ERROR: Extraneous extension properties exist");
            }
            break;
        case "timer":
            if(!extension.interval) {
                isComplete = false;
                extensiontestlogs[svr.id].push("ERROR: Missing interval value");
            } else if(!Number.isInteger(extension.interval)) {
                isComplete = false;
                extensiontestlogs[svr.id].push("ERROR: Invalid interval type, must be integer");
            } else if(extension.interval<10 || extension.interval>86400) {
                isComplete = false;
                extensiontestlogs[svr.id].push("ERROR: Invalid interval value, must be between 10 and 86400 seconds, inclusive");
            }

            if(Object.keys(extension)!=5) {
                extensiontestlogs[svr.id].push("ERROR: Extraneous extension properties exist");
            }
            break;
    }

    callback(isComplete);
}

// Applies new extension from admin console
function addExtension(extension, svr, consoleid, callback) {
    var consoleusr = svr.members.get("id", consoleid);
    if(consoleusr) {
        extensiontestlogs[svr.id] = [];
        validateExtension(extension, svr, function(valid) {
            if(valid) {
                logMsg(Date.now(), "INFO", svr.id, null, "Extension " + extension.name + " " + (configs.servers[svr.id].extensions[extension.name] ? "updated" : "added to server") + " (@" + consoleusr.username + ")");
                extension.store = {};
                configs.servers[svr.id].extensions[extension.name] = extension;
                if(extension.type=="timer") {
                    runTimerExtension(svr.id, extension.name);
                }
                extensiontestlogs[svr.id].push("INFO: Saved extension successfully");
                callback(valid);
            } else {
                extensiontestlogs[svr.id].push("FATAL: Invalid extension properties, see above");
                callback(valid);
            }
        }, configs.servers[svr.id].extensions[extension.name]!=null);
    } else {
        callback();
    }
}

// Default game: rotates between stats
function defaultGame(i, force) {
    var games = [bot.servers.length + " server" + (bot.servers.length==1 ? "" : "s") + " connected", "serving " + bot.users.length + " users", "awesomebot.xyz", "v" + version, "by @BitQuote", configs.hosting || "limited mode", "the best Discord bot!"];
    if(configs.game=="default" || force) {
        if(i>=games.length) {
            i = 0;
        }
        bot.setStatus("online", games[i]);
        setTimeout(function() {
            defaultGame(++i);
        }, 30000);
    }
}

// Adds default settings for a server to config.json
function defaultConfig(svr, override) {
    if(!configs.servers[svr.id] || override) {
        var adminList = [svr.owner.id];
        if(svr.members.get("id", configs.maintainer) && adminList.indexOf(configs.maintainer)==-1) {
            adminList.push(configs.maintainer);
        }
        for(var i=0; i<svr.members.length; i++) {
            var rolesOfMember = svr.rolesOfUser(svr.members[i]);
            if(rolesOfMember) {
                for(var j=0; j<rolesOfMember.length; j++) {
                    if(rolesOfMember[j] && typeof(rolesOfMember[j].hasPermission)=="function" && rolesOfMember[j].hasPermission("banMembers") && adminList.indexOf(svr.members[i].id)==-1 && configs.botblocked.indexOf(svr.members[i].id)==-1 && svr.members[i].id!=bot.user.id && !svr.members[i].bot) {
                        adminList.push(svr.members[i].id);
                    }
                }
            }
        }
        configs.servers[svr.id] = JSON.parse(JSON.stringify(configDefaults.default));
        configs.servers[svr.id].admins = adminList;
        for(var key in configDefaults.full) {
            configs.servers[svr.id][key] = JSON.parse(JSON.stringify(configDefaults.full[key]));
        }
        configs.servers[svr.id].motd[2] = svr.defaultChannel.id;
    }
}

// Update bot to new version via Git (beta)
function updateBot(msg) {
    logMsg(Date.now(), "INFO", "General", null, "Updating " + bot.user.username + ":");
    bot.sendMessage(msg.channel, "*Updating " + bot.user.username + ". This feature is in beta, and may not work.*");
    var spawn = require("child_process").spawn;
    var log = function(err, stdout, stderr) {
        if(stdout) {
            console.log(stdout);
        }
        if(stderr) {
            console.log(stderr);
        }
    };
    var upstream = spawn("git" ["add", "upstream", require("./package.json").repository.url]);
    upstream.stdout.on("data", function(data) {
        console.log(data.toString());
    });
    upstream.on("close", function(code) {
        var fetch = spawn("git", ["fetch", "upstream"]);
        fetch.stdout.on("data", function(data) {
            console.log(data.toString());
        });
        fetch.on("close", function(code) {
            var add = spawn("git", ["add", "data"]);
            add.stdout.on("data", function(data) {
                console.log(data.toString());
            });
            add.on("close", function(code) {
                var checkout = spawn("git", ["checkout", "."]);
                checkout.stdout.on("data", function(data) {
                    console.log(data.toString());
                });
                checkout.on("close", function(code) {
                    var npm = spawn("npm", ["install"]);
                    npm.stdout.on("data", function(data) {
                        console.log(data.toString());
                    });
                    npm.on("close", function(code) {
                        logMsg(Date.now(), "INFO", "General", null, "Successfully updated");
                        bot.sendMessage(msg.channel, "Done! Shutting down...", function() {
                            bot.logout(function() {
                                process.exit(1);
                            });
                        });
                    });
                });
            });
        });
    });
    logMsg(Date.now(), "ERROR", "General", null, "Could not update " + bot.user.username);
    bot.sendMessage(msg.channel, "Something went wrong, could not update.");
}

// Ensure that config.json is setup properly
function checkConfig(svr) {
    // Check for missing or excess keys
    for(var key in configDefaults.default) {
        if(configs.servers[svr.id][key]==null || typeof(configs.servers[svr.id][key])!=typeof(configDefaults.default[key])) {
            configs.servers[svr.id][key] = JSON.parse(JSON.stringify(configDefaults.default[key]));
        }
    }
    for(var key in configDefaults.full) {
        if(configs.servers[svr.id][key]==null || typeof(configs.servers[svr.id][key])!=typeof(configDefaults.full[key])) {
            configs.servers[svr.id][key] = JSON.parse(JSON.stringify(configDefaults.full[key]));
        }
    }

    for(key in configs.servers[svr.id]) {
        if(configDefaults.default[key]==null && configDefaults.full[key]==null) {
            delete configs.servers[svr.id][key];
        }
    }

    // Update data just for this version
    if(typeof(configs.servers[svr.id].newrole)=="string") {
        configs.servers[svr.id].newrole = [configs.servers[svr.id].newrole];
    }
    var channelIdArray = [];
    for(var i=0; i<svr.channels.length; i++) {
        if(!(svr.channels[i] instanceof Discord.VoiceChannel)) {
            channelIdArray.push(svr.channels[i].id);
        }
    }
    for(var extnm in configs.servers[svr.id].extensions) {
        if(!configs.servers[svr.id].extensions[extnm].name) {
            configs.servers[svr.id].extensions[extnm].name = extnm;
        }
        if(Array.isArray(configs.servers[svr.id].extensions[extnm].channels)) {
            for(var i=0; i<configs.servers[svr.id].extensions[extnm].channels.length; i++) {
                if(isNaN(configs.servers[svr.id].extensions[extnm].channels[i])) {
                    var ch = svr.channels.get("name", configs.servers[svr.id].extensions[extnm].channels[i]);
                    if(ch) {
                        configs.servers[svr.id].extensions[extnm].channels[i] = ch.id;
                    } else {
                        configs.servers[svr.id].extensions[extnm].channels.splice(i, 1);
                    }
                }
            }
        } else if(typeof(configs.servers[svr.id].extensions[extnm].channels)=="string") {
            var ch = svr.channels.get("name", configs.servers[svr.id].extensions[extnm].channels);
            if(ch) {
                configs.servers[svr.id].extensions[extnm].channels = [ch.id];
            } else {
                configs.servers[svr.id].extensions[extnm].channels = [];
            }
        }
        if(!configs.servers[svr.id].extensions[extnm].channels || configs.servers[svr.id].extensions[extnm].channels.length==0) {
            configs.servers[svr.id].extensions[extnm].channels = channelIdArray;
        }
    }
    if(configs.servers[svr.id].spamfilter[3]==null) {
        configs.servers[svr.id].spamfilter[3] = "mute";
    }
    if(configs.servers[svr.id].spamfilter[4]==null) {
        configs.servers[svr.id].spamfilter[4] = "";
    }
    if(configs.servers[svr.id].spamfilter[5]==null) {
        configs.servers[svr.id].spamfilter[5] = false;
    }
    if(configs.servers[svr.id].nsfwfilter[2]==null) {
        configs.servers[svr.id].nsfwfilter[2] = "block";
    }
    if(configs.servers[svr.id].nsfwfilter[3]==null) {
        configs.servers[svr.id].nsfwfilter[3] = "";
    }
    if(configs.servers[svr.id].nsfwfilter[4]==null) {
        configs.servers[svr.id].nsfwfilter[4] = false;
    }
    if(!Array.isArray(configs.servers[svr.id].filter[0])) {
        configs.servers[svr.id].filter = [
            configs.servers[svr.id].filter,
            "mute",
            "",
            false
        ];
    }
    if(!configs.servers[svr.id].rss[3] || configs.servers[svr.id].rss[3].length!=configs.servers[svr.id].rss[1].length) {
        configs.servers[svr.id].rss[3] = [];
        for(var i=0; i<configs.servers[svr.id].rss[1].length; i++) {
            configs.servers[svr.id].rss[3].push([
                [],
                ""
            ]);
        }
    }
    if(!configs.servers[svr.id].translated.channels) {
        configs.servers[svr.id].translated.channels = [];
        var channels = [];
        for(var i=0; i<svr.channels.length; i++) {
            if(!(svr.channels[i] instanceof Discord.VoiceChannel)) {
                channels.push(svr.channels[i].id);
            }
        }
        for(var i=0; i<configs.servers[svr.id].translated.list.length; i++) {
            configs.servers[svr.id].translated.channels.push(channels);
        }
    }
    if(!configs.servers[svr.id].motd[2]) {
        configs.servers[svr.id].motd[2] = svr.defaultChannel.id;
    }

    // Migrate stats data
    if(stats[svr.id]) {
        if(!stats[svr.id].cools) {
            stats[svr.id].cools = {};
        }
        if(!stats[svr.id].trivia) {
            stats[svr.id].trivia = {};
        }
    }
}

// Write an updated config.json file to disk
function saveData(file, callback) {
    var object;
    switch(file) {
        case "./data/profiles.json":
            object = profileData;
            break;
        case "./data/stats.json":
            object = stats;
            break;
        case "./data/config.json":
            object = configs;
            break;
        case "./auth.json":
            object = AuthDetails;
            break;
        case "./data/reminders.json":
            object = reminders;
            break;
        case "./data/polls.json":
            object = polls;
            break;
        case "./data/giveaways.json":
            object = giveaways;
            break;
        case "./data/logs.json":
            object = logs;
            break;
    }
    writeFileAtomic(file, JSON.stringify(object, null, 4), {chown:{uid: 100, gid: 50}}, function(error) {
        if(error) {
            fs.writeFile(file, JSON.stringify(object, null, 4), function(err) {
                callback(err);
            });
        } else {
            callback(error);
        }
    });
}

// Check if other admins of a server are logged into the console, return true if yes
function activeAdmins(svrid) {
    for(var i=0; i<configs.servers[svrid].admins.length; i++) {
        if(adminconsole[configs.servers[svrid].admins[i]] && adminconsole[configs.servers[svrid].admins[i]]==svrid) {
            return true;
        }
    }
    return false;
}

// Finds an active giveaway by name
function getGiveaway(name) {
    for(var usrid in giveaways) {
        if(giveaways[usrid].name.toLowerCase()==name.toLowerCase()) {
            return usrid;
        }
    }
    return;
}

// Check if there are other polls on the same channel
function activePolls(chid) {
    for(var poll in polls) {
        if(polls[poll].channel==chid) {
            return poll;
        }
    }
    return;
}

// Generate results for poll
function pollResults(usrid, intro, outro) {
    var responseCount = countOccurrences(polls[usrid].responses, polls[usrid].options);
    var info = "" + intro + " for the poll: **" + polls[usrid].title + "**";
    for(var i=0; i<polls[usrid].options.length; i++) {
        var c = responseCount[i];
        var d = true;
        if(!c || isNaN(c)) {
            c = 0;
            responseCount[i] = 0;
            d = false;
        }
        info += "\n\t" + i + ") " + polls[usrid].options[i] + ": " + c + " votes";
        if(d) {
            info += ", " + (Math.round((c / polls[usrid].responses.length * 100)*100)/100) + "%";
        }
    }

    var winner = maxIndex(responseCount);
    info += "\n" + polls[usrid].responses.length + " votes, ";
    if((responseCount.allValuesSame() || duplicateMax(responseCount)) && polls[usrid].options.length > 1) {
        info += "tie!";
    } else {
        info += outro + ": " + polls[usrid].options[winner];
    }
    info += "\n*Poll open for " + secondsToString((Date.now() - polls[usrid].timestamp)/1000).slice(0, -1) + "*";

    return info;
}

// Mutes or unmutes a user in a channel
function muteUser(ch, usr, callback) {
    if(configs.servers[ch.server.id].muted[ch.id]) {
        if(configs.servers[ch.server.id].muted[ch.id].indexOf(usr.id)>-1) {
            bot.overwritePermissions(ch, usr, {
                "sendMessages": true
            }, function(err) {
                if(err) {
                    callback(err, false);
                } else {
                    configs.servers[ch.server.id].muted[ch.id].splice(configs.servers[ch.server.id].muted[ch.id].indexOf(usr.id), 1);
                    if(configs.servers[ch.server.id].muted[ch.id].length==0) {
                        delete configs.servers[ch.server.id].muted[ch.id];
                    }
                    callback(null, false)
                }
            });
            return;
        }
    } else {
        configs.servers[ch.server.id].muted[ch.id] = [];
    }
    bot.overwritePermissions(ch, usr, {
        "sendMessages": false,
        "manageRoles": false,
        "manageChannel": false
    }, function(err) {
        if(err) {
            callback(true, true);
        } else {
            configs.servers[ch.server.id].muted[ch.id].push(usr.id);
            callback(null, true);
        }
    });
}

// Attempt to kick a member
function handleViolation(msg, desc1, desc2, action) {
    switch(action) {
        case "kick":
            bot.kickMember(msg.author, msg.channel.server, function(err) {
                if(err) {
                    blockUser(msg, desc1, desc2);
                } else {
                    adminMsg(err, msg.channel.server, msg.author, " " + desc1 + " #" + msg.channel.name + " in " + msg.channel.server.name + ", so I kicked them from the server.");
                }
            });
            break;
        case "mute":
            muteUser(msg.channel, msg.author, function(err, state) {
                if(err) {
                    blockUser(msg, desc1, desc2);
                } else {
                    adminMsg(err, msg.channel.server, msg.author, " " + desc1 + " #" + msg.channel.name + " in " + msg.channel.server.name + ", so I muted them in that channel.");
                }
            });
            break;
        case "block":
            blockUser(msg, desc1, desc2);
            break;
    }
}

// Block user (if kick fails)
function blockUser(msg, desc1, desc2) {
    bot.sendMessage(msg.author, "Stop " + desc2 + ". The chat mods have been notified about this, and you have been blocked from using me.");
    adminMsg(false, msg.channel.server, msg.author, " " + desc1 + " #" + msg.channel.name + " in " + msg.channel.server.name + ", so I blocked them from using me.");
    if(configs.servers[msg.channel.server.id].blocked.indexOf(msg.author.id)==-1) {
        configs.servers[msg.channel.server.id].blocked.push(msg.author.id);
    }
}

// Check if a given query is NSFW
function checkFiltered(msg, checknsfw, checkfilter) {
    if(checknsfw) {
        for(var i=0; i<filter.length; i++) {
            if((" " + msg + " ").toLowerCase().indexOf(" " + filter[i] + " ")>-1) {
                return true;
            }
        }
    }
    if(checkfilter) {
        for(var i=0; i<configs.servers[msg.channel.server.id].filter[0].length; i++) {
            if((" " + msg + " ").toLowerCase().indexOf(" " + configs.servers[msg.channel.server.id].filter[0][i] + " ")>-1) {
                return true;
            }
        }
    }
    return false;
}

// Handle an NSFW bot query or filtered word
function handleFiltered(msg, type) {
    var action = filterviolations[msg.channel.server.id][msg.author.id]!=null;
    logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Handling " + (action ? "second-time" : "") + " filtered message '" + msg.content + "' from " + msg.author.username);
    var description = type=="NSFW" ? ("attempting to fetch NSFW content (`" + msg.cleanContent + "`)") : ("using filtered words (`" + msg.cleanContent + "`)");
    if(action) {
        var role;
        if(type=="NSFW" && configs.servers[msg.channel.server.id].nsfwfilter[3]) {
            role = msg.channel.server.roles.get("id", configs.servers[msg.channel.server.id].nsfwfilter[3]);
        } else if(type!="NSFW" && configs.servers[msg.channel.server.id].filter[2]) {
            role = msg.channel.server.roles.get("id", configs.servers[msg.channel.server.id].filter[2]);
        }
        if(role && !bot.memberHasRole(msg.author, role)) {
            bot.addMemberToRole(msg.author, role, function(err) {
                if(err) {
                    logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to add " + msg.author.username + " to role " + role.name + " after filtered message");
                } else {
                    logMsg(Date.now(), "INFO", msg.channel.server.id, msg.channel.id, "Added " + msg.author.username + " to role " + role.name + " after filtered message");
                }
            });
        }
        if((type=="NSFW" && configs.servers[msg.channel.server.id].nsfwfilter[4]) || (type!="NSFW" && configs.servers[msg.channel.server.id].filter[3])) {
            bot.deleteMessage(msg, function(err) {
                if(err) {
                    logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Failed to delete filtered message from " + msg.author.username);
                } else {
                    logMsg(Date.now(), "ERROR", msg.channel.server.id, msg.channel.id, "Deleted filtered message from " + msg.author.username);
                }
            });
        }
        handleViolation(msg, "is still " + description, description, type=="NSFW" ? configs.servers[msg.channel.server.id].nsfwfilter[2] : configs.servers[msg.channel.server.id].filter[1]);
        delete filterviolations[msg.channel.server.id][msg.author.id];
    } else {
        filterviolations[msg.channel.server.id][msg.author.id] = true;
        bot.sendMessage(msg.author, "Stop " + description + " in " + msg.channel.server.name + ". The chat mods have been notified about this.");
        adminMsg(false, msg.channel.server, msg.author, " is " + description + " in #" + msg.channel.name + " in " + msg.channel.server.name);
    }
    if(configs.servers[msg.channel.server.id].points) {
        if(!profileData[msg.author.id]) {
            profileData[msg.author.id] = {
                points: 0
            }
        }
        profileData[msg.author.id].points -= action ? 200 : 100;
    }
    checkStats(msg.author.id, msg.channel.server.id);
    stats[msg.channel.server.id].members[msg.author.id].strikes.push(["Automatic", (action ? "Second" : "First") + "-time filter violation: \"" + msg.cleanContent + "\"", Date.now()]);
}

// Returns the formatted command prefix for a server
function getPrefix(svr) {
    return (configs.servers[svr.id].cmdtag=="tag" ? ("@" + (svr.detailsOfUser(bot.user).nick || bot.user.username) + " ") : configs.servers[svr.id].cmdtag);
}

// Returns the name of a user on a server according to configs
function getName(svr, usr) {
    return removeMd((configs.servers[svr.id].usenicks ? (svr.detailsOfUser(usr).nick || usr.username) : usr.username) + (configs.servers[svr.id].usediscriminators ? ("#" + usr.discriminator) : "")).replaceAll("_", "").replaceAll("_", "");
}

String.prototype.replaceAll = function(target, replacement) {
    return this.split(target).join(replacement);
};

// Searches for a server member based on name, ID, or nick
function userSearch(str, svr) {
    var usr;
    str = str.trim();
    if(str.indexOf("<@!")==0) {
        usr = svr.members.get("id", str.substring(3, str.length-1));
    } else if(str.indexOf("<@")==0) {
        usr = svr.members.get("id", str.substring(2, str.length-1));
    } else if(!isNaN(str)) {
        usr = svr.members.get("id", str);
    } else if(str.lastIndexOf("#")==str.length-5 && !isNaN(str.substring(str.lastIndexOf("#")+1))) {
        usr = svr.members.getAll("username", str.substring(0, str.lastIndexOf("#"))).get("discriminator", str.substring(str.lastIndexOf("#")+1));
    } else {
        usr = svr.members.get("username", str);
    }
    if(!usr) {
        for(var i=0; i<svr.members.length; i++) {
            if(svr.detailsOfUser(svr.members[i]).nick && svr.detailsOfUser(svr.members[i]).nick==str) {
                usr = svr.members[i];
                break;
            }
        }
    }
    return usr;
}

// Searches for a server based on name, ID, or shortcut
function serverSearch(str, usr) {
    var findServer = function() {
        var svr = bot.servers.get("name", str);
        if(checkServer(svr, usr)) {
            return svr;
        }

        svr = bot.servers.get("id", str);
        if(checkServer(svr, usr)) {
            return svr;
        }

        for(var i=0; i<bot.servers.length; i++) {
            if(str.toLowerCase()==bot.servers[i].name.toLowerCase() && checkServer(bot.servers[i], usr)) {
                return bot.servers[i];
            }
        }

        if(profileData[usr.id] && profileData[usr.id].svrnicks && profileData[usr.id].svrnicks[str.toLowerCase()]) {
            svr = bot.servers.get("id", profileData[usr.id].svrnicks[str.toLowerCase()]);
            if(checkServer(svr, usr)) {
                return svr;
            }
        }

        logMsg(Date.now(), "WARN", null, usr.id, "User provided invalid server '" + str + "'");
        return;
    }
    var result = findServer();
    if(result && !readiedServers[result.id]) {
        readyServer(result);
    }
    return result;
}

// Checks if a server is fine
function checkServer(svr, usr) {
    return svr && svr.members.get("id", usr.id) && configs.servers[svr.id].blocked.indexOf(usr.id)==-1;
}

// Searches for a channel based on name or ID
function channelSearch(str, svr) {
    var channels = svr.channels.getAll("type", "text");
    var ch;
    if(str.indexOf("#")==0) {
        str = str.slice(1);
    }
    if(!isNaN(str)) {
        ch = channels.get("id", str);
        if(!ch) {
            ch = channels.get("position", str);
        }
    }
    if(!ch) {
        ch = channels.get("name", str);
    }
    return ch;
}

// Parses app list for linkme/appstore
function getAppList(suffix) {
    var apps = suffix.split(",");
    for(var i=0; i<apps.length; i++) {
        if(!apps[i] || (apps.indexOf(apps[i])!=i && apps.indexOf(apps[i])>-1)) {
            apps.splice(i, 1);
        }
    }
    return apps;
}

// Searches Google Images for keyword(s)
function giSearch(query, num, svrid, chid, callback) {
    try {
        var url = "https://www.googleapis.com/customsearch/v1?key=" + (configs.servers[svrid].customkeys.google_api_key || AuthDetails.google_api_key) + "&cx=" + (configs.servers[svrid].customkeys.custom_search_id || AuthDetails.custom_search_id) + ((configs.servers[svrid].nsfwfilter[0] && configs.servers[svrid].nsfwfilter[1].indexOf(chid)==-1) ? "&safe=high" : "") + "&q=" + encodeURI(query.replace(/&/g, '')) + "&alt=json&searchType=image" + (num ? ("&start=" + num) : "");
        unirest.get(url)
        .header("Accept", "application/json")
        .end(function(response) {
            try {
                var data = response.body;

                if(!data) {
                    logMsg(Date.now(), "ERROR", svrid, chid, "Could not connect to Google Images");
                    callback(null);
                } else if(data.error) {
                    if(data.error.code==403) {
                        logMsg(Date.now(), "WARN", svrid, chid, "Hit daily Google Images API rate limit");
                        callback(false);
                    } else {
                        logMsg(Date.now(), "ERROR", svrid, chid, "Google Images API error");
                        callback(null);
                    }
                } else if(!data.items || data.items.length==0 || query.indexOf("<#")>-1) {
                    logMsg(Date.now(), "WARN", svrid, chid, "No image results for " + query);
                    callback(null);
                } else {
                    callback(data.items[0].link);
                }
            } catch(error) {
                logMsg(Date.now(), "ERROR", svrid, chid, "Failed to process image search request");
                return;
            }
        });
    } catch(err) {
        logMsg(Date.now(), "ERROR", "General", null, "Failed to process image search request");
        return;
    }
}

// Google Play Store search page scraper
function scrapeSearch(data) {
    x = cheerio.load(data);
    var card_list = x(".card-list");
    var items = [];
    card_list.find(".card").each(function() {
        var card = {};
        var card_data = x(this);
        card["cover-image"] = card_data.find("img.cover-image").attr("src");
        card["click-target"] = card_data.find(".card-click-target").attr("src");
        card["name"] = card_data.find(".details .title").attr("title");
        card["url"] = "https://play.google.com" + card_data.find(".details .title").attr("href");
        card["company"] = card_data.find(".details .subtitle").attr("title");
        card["html_description"] = card_data.find(".details .description").text();
        card["rating_description"] = card_data.find(".tiny-star").attr("aria-label");
        var rating_style = card_data.find(".tiny-star .current-rating").attr("style");
        if(rating_style) {
            card["rating"] = parseFloat(rating_style.match(/\d+/g)[0]*5 / 100.0);
        } else {
            card["rating"] = "unknown";
        }
        card["price"] = card_data.find(".price-container .display-price").text();

        items.push(card);
    });

    var result = {
        total: items.length,
        items: items
    };

    return result;
}

// Searches Giphy for matching GIFs
function getGIF(tags, rating, callback) {
    try {
        var params = {
            "api_key": AuthDetails.giphy_api_key,
            "rating": rating,
            "format": "json",
            "limit": 1
        };
        var query = qs.stringify(params);

        if(tags!==null) {
            query += "&tag=" + tags.join("+")
        }

        unirest.get("http://api.giphy.com/v1/gifs/random?" + query)
        .header("Accept", "application/json")
        .end(function(response) {
            if(response.status!==200 || !response.body) {
                logMsg(Date.now(), "ERROR", "General", null, "Could not connect to Giphy");
                callback(null);
            } else {
                callback(response.body.data.id);
            }
        }.bind(this));
    } catch(err) {
        logMsg(Date.now(), "ERROR", "General", null, "Failed to process GIF search request");
    }
}

// Get YouTube URL given tags as query
function ytSearch(query, svrid, callback) {
    var youtube = new youtube_node();
    youtube.setKey(configs.servers[svrid].customkeys.google_api_key || AuthDetails.google_api_key);
    var q;
	youtube.search(query, 1, function(error, result) {
        if(error) {
            logMsg(Date.now(), "ERROR", "General", null, "Could not connect to YouTube");
            q =  "`¯\\_(ツ)_/¯`";
        } else {
            if (!result || !result.items || result.items.length < 1) {
                logMsg(Date.now(), "WARN", "General", null, "No YouTube results for " + query);
                q = "`¯\\_(ツ)_/¯`";
            } else {
                switch(result.items[0].id.kind) {
                    case "youtube#playlist":
                        q = "http://www.youtube.com/playlist?list=" + result.items[0].id.playlistId;
                        break;
                    case "youtube#video":
                        q = "http://www.youtube.com/watch?v=" + result.items[0].id.videoId;
                        break;
                    case "youtube#channel":
                        q = "http://www.youtube.com/channel/" + result.items[0].id.channelId;
                        break;
                }
            }
        }
        callback(q);
    });
}

// Generate printable stats for a server
function getStats(svr) {
    var sortedMembers = [];
    var sortedRichest = [];
    for(var member in stats[svr.id].members) {
        sortedMembers.push([member, stats[svr.id].members[member].messages]);
        sortedRichest.push([member, profileData[member] ? profileData[member].points : 0]);
    }
    sortedMembers.sort(function(a, b) {
        return a[1] - b[1];
    });
    sortedRichest.sort(function(a, b) {
        return a[1] - b[1];
    });
    var sortedGames = [];
    for(var game in stats[svr.id].games) {
        sortedGames.push([game, stats[svr.id].games[game]]);
    }
    sortedGames.sort(function(a, b) {
        return a[1] - b[1];
    });
    var sortedCommands = [];
    var commandSum = 0;
    for(var cmd in stats[svr.id].commands) {
        commandSum += stats[svr.id].commands[cmd];
        sortedCommands.push([cmd, stats[svr.id].commands[cmd]]);
    }
    sortedCommands.sort(function(a, b) {
        return a[1] - b[1];
    });

    var info = {
        "Most active members": [],
        "Richest members": [],
        "Most played games": [],
        "Command usage": [],
        "Data since": prettyDate(new Date(stats.timestamp))
    };
    for(var i=sortedMembers.length-1; i>sortedMembers.length-6; i--) {
        if(i<0) {
            break;
        }
        var usr = svr.members.get("id", sortedMembers[i][0]);
        if(usr && sortedMembers[i][1]>0) {
            info["Most active members"].push(getName(svr, usr) + ": " + sortedMembers[i][1] + " message" + (sortedMembers[i][1]==1 ? "" : "s"));
        }
    }
    if(configs.servers[svr.id].points) {
        for(var i=sortedRichest.length-1; i>sortedRichest.length-6; i--) {
            if(i<0) {
                break;
            }
            var usr = svr.members.get("id", sortedRichest[i][0]);
            if(usr && sortedRichest[i][1]>0) {
                info["Richest members"].push(getName(svr, usr) + ": " + sortedRichest[i][1] + " point" + (sortedRichest[i][1]==1 ? "" : "s"));
            }
        }
    }
    for(var i=sortedGames.length-1; i>sortedGames.length-6; i--) {
        if(i<0) {
            break;
        }
        info["Most played games"].push(sortedGames[i][0] + ": " + secondsToString(sortedGames[i][1] * 3000));
    }
    for(var i=sortedCommands.length-1; i>sortedCommands.length-6; i--) {
        if(i<0) {
            break;
        }
        if(sortedCommands[i][1]>0) {
            var p = Math.floor(100 * sortedCommands[i][1] / commandSum);
            info["Command usage"].push(("  " + p).substring(p.toString().length-1) + "% " + sortedCommands[i][0] + ": " + sortedCommands[i][1] + " use" + (sortedCommands[i][1]==1 ? "" : "s"));
        }
    }
    for(var key in info) {
        if(info[key].length==0) {
            delete info[key];
        }
    }
    return info;
}

// Get total command usage across all servers
function totalCommandUsage() {
    var usage = {};
    for(var svrid in stats) {
        if(svrid=="timestamp") {
            continue;
        }
        var svr = bot.servers.get("id", svrid);
        if(svr) {
            for(var cmd in stats[svrid].commands) {
                if(commands[cmd]) {
                    if(!usage[cmd]) {
                        usage[cmd] = 0;
                    }
                    usage[cmd] += stats[svrid].commands[cmd];
                }
            }
        }
    }

    var cmds = [];
    var sum = 0;
    for(var cmd in usage) {
        sum += usage[cmd];
        cmds.push([cmd, usage[cmd]]);
    }
    cmds.sort(function(a, b) {
        return a[1] - b[1];
    });
    for(var i=cmds.length-1; i>=0; i--) {
        var p = Math.floor(100 * cmds[i][1] / sum);
        cmds[i] = ("  " + p).substring(p.toString().length-1) + "% " + cmds[i][0] + ": " + cmds[i][1] + " use" + (cmds[i][1]==1 ? "" : "s");
    }
    return cmds;
}

// Generate printable user profile
function getProfile(usr, svr) {
    var usrinfo = {
        "Username": usr.username,
        "ID": usr.id,
        "Discriminator": usr.discriminator,
        "Status": usr.status
    }
    usrinfo["Avatar"] = "http://i.imgur.com/fU70HJK.png";
    if(usr.avatarURL) {
        usrinfo["Avatar"] = usr.avatarURL;
    }
    if(getGame(usr)) {
        usrinfo["Playing"] = getGame(usr)
    }
    if(!profileData[usr.id]) {
        profileData[usr.id] = {
            points: 0
        };
    }
    for(var field in profileData[usr.id]) {
        if((!configs.servers[svr.id].points && field=="points") || ["svrnicks", "afk"].indexOf(field)>-1) {
            continue;
        }
        usrinfo[field.charAt(0).toUpperCase() + field.slice(1)] = profileData[usr.id][field].toString();
    }
    var details = svr.detailsOfUser(usr);
    var svrinfo = {};
    if(details) {
        if(details.roles && details.roles.length>0) {
            svrinfo["Roles"] = "";
            for(var i=0; i<details.roles.length; i++) {
                if(details.roles[i]) {
                    svrinfo["Roles"] += (svrinfo["Roles"].trim().length==0 ? "" : ", ") + details.roles[i].name;
                }
            }
        }
        if(details.joinedAt) {
            svrinfo["Joined"] = prettyDate(new Date(details.joinedAt));
        }
    }
    checkStats(usr.id, svr.id);
    if(configs.servers[svr.id].stats) {
        svrinfo["Messages"] = stats[svr.id].members[usr.id].messages + " this week";
    }
    if(configs.servers[svr.id].ranks) {
        svrinfo["Rank"] = stats[svr.id].members[usr.id].rank;
    }
    if(usr.status!="online" && configs.servers[svr.id].stats) {
        var seen = prettyDate(new Date(stats[svr.id].members[usr.id].seen));
        svrinfo["Last seen"] = secondsToString((Date.now() - stats[svr.id].members[usr.id].seen)/1000) + "ago";
    }
    svrinfo["Strikes"] = stats[svr.id].members[usr.id].strikes.length + " so far";
    for(var key in stats[svr.id].members[usr.id]) {
        if(["messages", "active", "seen", "mentions", "strikes", "rankscore", "voice"].indexOf(key)==-1) {
            svrinfo[key.charAt(0).toUpperCase() + key.slice(1)] = stats[svr.id].members[usr.id][key];
        }
    }
    var info = {};
    info["User profile: @" + getName(svr, usr)] = usrinfo;
    info["On " + svr.name] = svrinfo;
    return info;
}

// Get the game a user is playing
function getGame(usr) {
    if(usr.game) {
        if(usr.game.name) {
            return usr.game.name;
        } else {
            return usr.game;
        }
    } else {
        return;
    }
}

// Check if bot has a permission on a server
function botHasPermission(permission, svr) {
    var roles = svr.rolesOfUser(bot.user);
    for(var i=0; i<roles.length; i++) {
        if(roles[i].hasPermission(permission)) {
            return true;
        }
    }
    return false;
}

// Delete messages from a user
function cleanMessages(ch, usr, num, callback) {
    if(!botHasPermission("manageMessages", ch.server)) {
        callback(true);
        return;
    }
    nodeletemembermsg[ch.id] = true;

    var doClean = function(option) {
        getMessages(ch, option, function(err, messages) {
            if(err) {
                logMsg(Date.now(), "ERROR", ch.server.id, ch.id, "Failed to fetch old messages for " + (usr ? "cleaning" : "purging"));
                delete nodeletemembermsg[ch.id];
                callback(err);
            } else {
                var toDelete = [];
                for(var i=0; i<messages.length; i++) {
                    if(!usr || messages[i].author.id==usr.id) {
                        toDelete.push(messages[i]);
                        num--;
                    }
                    if(num==0) {
                        break;
                    }
                }

                if(toDelete.length>1) {
                    bot.deleteMessages(toDelete, function(err) {
                        if(err) {
                            logMsg(Date.now(), "ERROR", ch.server.id, ch.id, "Failed to " + (usr ? "clean" : "purge") + " messages" + (usr ? (" from " + usr.username) : ""));
                            delete nodeletemembermsg[ch.id];
                            callback(err);
                        } else if(num==0) {
                            logMsg(Date.now(), "INFO", ch.server.id, ch.id, "Finished " + (usr ? "cleaning" : "purging") + " messages" + (usr ? (" from " + usr.username) : ""));
                            delete nodeletemembermsg[ch.id];
                            callback();
                        } else {
                            doClean({before: messages[messages.length-1]});
                        }
                    });
                }
            }
        });
    };
    doClean();
}

// Archives messages in a channel
function archiveMessages(ch, count, callback) {
    var archive = [];
    var doArchive = function(num) {
        bot.getChannelLogs(ch, num, function(error, messages) {
            if(!error) {
                for(var i=0; i<messages.length; i++) {
                    archive.push({
                        timestamp: messages[i].timestamp,
                        id: messages[i].id,
                        edited: messages[i].editedTimestamp!=null,
                        content: messages[i].content,
                        clean_content: messages[i].cleanContent,
                        attachments: messages[i].attachments,
                        author: {
                            username: messages[i].author.username,
                            discriminator: messages[i].author.username,
                            avatar: messages[i].author.avatar
                        }
                    });
                }
                if(archive.length==count || messages.length<num) {
                    callback(false, archive);
                } else {
                    var nextcount = count - messages.length;
                    doArchive(nextcount>100 ? 100 : nextcount);
                }
            } else {
                logMsg(Date.now(), "ERROR", ch.server.id, ch.id, "Failed to fetch old messages for archival");
                callback(true);
            }
        });
    };
    doArchive(count>100 ? 100 : count);
}

// Set reminder from natural language command
function parseReminder(str, usr, ch) {
    var tag = ch.isPrivate ? "" : (usr + " ");
    var timestr, remind;
    if(str.split("|").length==2) {
        timestr = str.split("|")[0];
        remind = str.split("|")[1];
    } else {
        timestr = str.substring(str.toLowerCase().indexOf(" in ")+4);
        remind = str.indexOf("to ")==0 ? str.substring(3, str.toLowerCase().indexOf(" in ")) : str.substring(0, str.indexOf(" in "));
    }
    var time = parseTime(timestr);
    if(!time) {
        bot.sendMessage(ch, tag + "Sorry, I don't know what that means. Make sure you're using the syntax `remindme <no.> <h, m, or s> <note>`");
        return;
    }
    logMsg(Date.now(), "INFO", null, usr.id, "Reminder set in " + time.num + time.time);
    bot.sendMessage(ch, tag + "OK, I'll send you a PM in " + time.num + " " + time.time);
    saveReminder(usr.id, remind, time.countdown);
}

// Parse a string as a number of seconds, minutes, hours, or days
function parseTime(str) {
    var num, time;
    if(str.indexOf(" ")>-1) {
        num = str.substring(0, str.indexOf(" "));
        time = str.substring(str.indexOf(" ")+1).toLowerCase();
    } else {
        for(var i=0; i<str.length; i++) {
            if(str.substring(0, i) && !isNaN(str.substring(0, i)) && isNaN(str.substring(0, i+1))) {
                num = str.substring(0, i);
                time = str.substring(i);
                break;
            }
        }
    }
    if(!num || isNaN(num) || num<1 || !time || ["d", "day", "days", "h", "hr", "hrs", "hour", "hours", "m", "min", "mins", "minute", "minutes", "s", "sec", "secs", "second", "seconds"].indexOf(time)==-1) {
        return;
    }
    var countdown = 0;
    switch(time) {
        case "d":
        case "day":
        case "days":
            countdown = num * 86400000;
            break;
        case "h":
        case "hr":
        case "hrs":
        case "hour":
        case "hours":
            countdown = num * 3600000;
            break;
        case "m":
        case "min":
        case "mins":
        case "minute":
        case "minutes":
            countdown = num * 60000;
            break;
        case "s":
        case "sec":
        case "secs":
        case "second":
        case "seconds":
            countdown = num * 1000;
            break;
    }
    return {
        num: num,
        time: time,
        countdown: countdown
    };
}

// Save a reminder
function saveReminder(usrid, remind, countdown) {
    reminders.push({
        user: usrid,
        note: remind,
        time: Date.now() + countdown
    });
    setReminder(reminders.length-1);
    saveData("./data/reminders.json", function(err) {
        if(err) {
            logMsg(Date.now(), "ERROR", usrid, null, "Failed to save reminder");
        }
    });
}

// Set and send a reminder
function setReminder(i) {
    var obj = reminders[i];
    var usr = bot.users.get("id", obj.user);
    if(usr && obj) {
        var countdown = obj.time - Date.now();
        setTimeout(function() {
            bot.sendMessage(usr, "**Reminder:** " + obj.note);
            logMsg(Date.now(), "INFO", null, usr.id, "Reminded user for note set at " + prettyDate(new Date(obj.time)));
            reminders.splice(i, 1);
            saveData("./data/reminders.json", function(err) {
                if(err) {
                    logMsg(Date.now(), "ERROR", null, usr.id, "Failed to save reminder");
                }
            });
        }, countdown>0 ? countdown : 0);
    }
}

// Retrieve past messages for clean command
function getMessages(ch, option, callback) {
    if(option) {
        bot.getChannelLogs(ch, option, function(error, messages) {
            callback(error, messages);
        });
    } else {
        bot.getChannelLogs(ch, function(error, messages) {
            callback(error, messages);
        });
    }
}

// Message online bot admins in a server
function adminMsg(error, svr, author, info) {
    if(!error) {
        for(var i=0; i<configs.servers[svr.id].admins.length; i++) {
            var usr = svr.members.get("id", configs.servers[svr.id].admins[i]);
            if(usr && usr.status!="offline") {
                bot.sendMessage(usr, "**@" + author.username + "**" + info);
            }
        }
    } else {
        logMsg(Date.now(), "ERROR", svr.id, null, "Failed to message bot admins");
    }
}

// Ouput a pretty date for logging
function prettyDate(date) {
    try {
        return date.getUTCFullYear() + "-" + ("0" + (date.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + date.getUTCDate()).slice(-2) + " " + ("0" + date.getUTCHours()).slice(-2) + ":" + ("0" + date.getUTCMinutes()).slice(-2) + ":" + ("0" + date.getUTCSeconds()).slice(-2) + " UTC";
    } catch(err) {
        logMsg(Date.now(), "ERROR", "General", null, "Failed to process prettyDate request");
        return;
    }
}

// Number of days between two dates
function dayDiff(first, second) {
    return Math.round((second-first) / (1000*60*60*24));
}

// Send messages in an array
function sendArray(ch, arr, i) {
    if(!i) {
        i = 0;
    } else if(i>=arr.length) {
        return;
    }
    bot.sendMessage(ch, arr[i], function(err, msg) {
        sendArray(ch, arr, ++i);
    });
}

// Return true if a string is an existing commnand, tag, or extension
function checkCommandConflicts(name, svr, overrideextensions) {
    name = name.toLowerCase().trim();
    if(commands[name] || configs.servers[svr.id].tagcommands.indexOf(name)>-1) {
        return true;
    }
    if(!overrideextensions) {
        for(var extnm in configs.servers[svr.id].extensions) {
            if(configs.servers[svr.id].extensions[extnm].type=="command" && configs.servers[svr.id].extensions[extnm].key==name) {
                return true;
            }
        }
    }
    return false;
}

// Generate help text
function getHelp(svr, usr) {
    var help = [];
    var info = [];
    for(var cmd in commands) {
        if(commands[cmd]) {
            if(configs.servers[svr.id][cmd]==false || cmd=="eval") {
                continue;
            }
            if(cmd=="rss") {
                if(!configs.servers[svr.id][cmd][0]) {
                    continue;
                }
            }
            if(["messages", "games"].indexOf(cmd)>-1 && configs.servers[svr.id].stats==false) {
                continue;
            }
            if(cmd=="ranks" && configs.servers[svr.id].points==false) {
                continue;
            }
            if(configs.servers[svr.id].admincommands.indexOf(cmd)>-1 && configs.servers[svr.id].admins.indexOf(usr.id)==-1) {
                continue;
            }
            var tmpinfo = "\n" + getPrefix(svr) + cmd;
            if(commands[cmd].usage) {
                tmpinfo += " " + commands[cmd].usage;
            }
            info.push(tmpinfo);
        }
    }
    info = info.sort().join("");
    if(info) {
        help.push("```" + info + "```");
        info = "";
    }
    for(var ext in configs.servers[svr.id].extensions) {
        if(configs.servers[svr.id].extensions[ext].type.toLowerCase()=="command") {
            info += "\n" + getPrefix(svr) + configs.servers[svr.id].extensions[ext].key;
            if(configs.servers[svr.id].extensions[ext].usage) {
                info += " " + configs.servers[svr.id].extensions[ext].usage;
            }
        }
    }
    if(info) {
        help.push("```" + info + "```");
        info = "";
    }

    help.push("For the above command list, do not include the angle brackets (`<` and `>`). Also note that the square brackets (`[` and`]`) simply denote that the parameter is optional; don't include them either.");

    if(configs.servers[svr.id].rss[2].length>0) {
        info += "\nThe following RSS feeds are available:";
        for(var i=0; i<configs.servers[svr.id].rss[2].length; i++) {
            info += "\n\t" + configs.servers[svr.id].rss[2][i];
        }
    }
    if(info) {
        help.push(info);
        info = "";
    }

    if(Object.keys(configs.servers[svr.id].triviasets).length>0) {
        info += "The follow custom trivia sets are available:";
        for(var tset in configs.servers[svr.id].triviasets) {
            info += "\n\t" + tset;
        }
    }
    if(info) {
        help.push(info);
        info = "";
    }

    info = [];
    for(var cmd in pmcommands) {
        var tmpinfo = "\n" + cmd;
        if(pmcommands[cmd].usage) {
            tmpinfo += " " + pmcommands[cmd].usage.replace("<server>", svr.name);
        }
        info.push(tmpinfo);
    }
    help.push("The following commands are also available via PM:```" + info.sort().join("") + "```");

    if(configs.servers[svr.id].points) {
        help.push("\nFinally: *AwesomePoints*, a karma system for Discord. You can upvote someone with `@user <\"^\", \"+1\", or \"up\">`, and give 10 of your own points with `@user gild`. You'll lose points for doing bad things, and get a reward for being the most active user at the end of the week.");
    }

    help.push("\nOn top of all this, you can talk to me about anything privately or in the main chat (by tagging me). Learn more on my wiki: http://wiki.awesomebot.xyz/ \n\nVersion " + version + " by **@BitQuote**, http://awesomebot.xyz/. *This project is in no way affiliated with Alphabet, Inc., who does not own or endorse this product.*");
    return help;
}

// Get info on a specific command
function getCommandHelp(svr, cmd) {
    var pubdisabled = false;
    if(configs.servers[svr.id][cmd]) {
        if(!configs.servers[svr.id][cmd]) {
            pubdisabled = true;
            if(!pmcommands[cmd]) {
                return "`" + cmd + "` is disabled on this server.";
            }
        }
    }
    var info = "";
    var filled = false;
    if(commands[cmd] && !pubdisabled) {
        filled = true;
        info += "**Help for public command `" + cmd + "`:**```" + getPrefix(svr) + cmd + (commands[cmd].usage ? (" " + commands[cmd].usage) : "") + "```\nhttps://github.com/BitQuote/AwesomeBot/wiki/Commands#" + cmd;
    }
    if(pmcommands[cmd] && cmd!="remindme") {
        info += (filled ? "\n\n" : "") + "**Help for private command `" + cmd + "`:**```" + cmd + (pmcommands[cmd].usage ? (" " + pmcommands[cmd].usage) : "") + "```\nhttps://github.com/BitQuote/AwesomeBot/wiki/Commands#" + cmd + "-pm";
        filled = true;
    }
    for(var ext in configs.servers[svr.id].extensions) {
        if(configs.servers[svr.id].extensions[ext].type.toLowerCase()=="command" && configs.servers[svr.id].extensions[ext].extended && configs.servers[svr.id].extensions[ext].key==cmd) {
            info += (filled ? "\n\n" : "") + "**Help for public extension command `" + configs.servers[svr.id].extensions[ext].key + "`:**```" + getPrefix(svr) + configs.servers[svr.id].extensions[ext].key + (configs.servers[svr.id].extensions[ext].usage ? (" " + configs.servers[svr.id].extensions[ext].usage) : "") + "```\n" + configs.servers[svr.id].extensions[ext].extended;
            filled = true;
        }
    }
    if(!info) {
        info = "Extended help for `" + cmd + "` not available.";
    }
    return info;
}

// Log to database and console
function logMsg(timestamp, level, id, ch, msg) {
    logs.stream.push({
        timestamp: timestamp,
        level: level,
        id: id,
        ch: ch,
        msg: msg
    });
    console.log(printLog(logs.stream[logs.stream.length-1]));
}

// Get printable log message
function printLog(log) {
    var info = "";
    try {
        info = "[" + prettyDate(new Date(log.timestamp)) + "] [" + log.level + "] [";
        if(!log.id && !isNaN(log.ch)) {
            var usr = bot.users.get("id", log.ch);
            info += "@" + (usr ? usr.username : "invalid-user");
        } else if(log.id=="General") {
            info += "General";
        } else if(!isNaN(log.id) && !log.ch) {
            var svr = bot.servers.get("id", log.id);
            info += svr ? svr.name : "invalid-server";
        } else if(!isNaN(log.id) && !isNaN(log.ch)) {
            var svr = bot.servers.get("id", log.id);
            var ch = bot.channels.get("id", log.ch);
            info += (svr ? svr.name : "invalid-server") + ", " + (ch ? ch.name : "invalid-channel");
        }
        info += "] " + log.msg;
        return info;
    } catch (err) {
        return "";
    }
}

// Filter and print logs by parameter
function getLog(idFilter, levelFilter) {
    if(idFilter) {
        var type = idFilter.substring(0, idFilter.indexOf("-"));
        idFilter = idFilter.substring(idFilter.indexOf("-")+1);
    }
    var results = logs.stream.filter(function(obj) {
        if(idFilter && levelFilter) {
            return (type=="server" ? (obj.id==idFilter && checkLogID(obj.id)) : obj.ch==idFilter) && obj.level==levelFilter;
        } else if(idFilter && !levelFilter) {
            return (type=="server" ? (obj.id==idFilter && checkLogID(obj.id)) : obj.ch==idFilter);
        } else if(!idFilter && levelFilter) {
            return obj.level==levelFilter;
        } else {
            if(!isNaN(obj.id)) {
                return checkLogID(obj.id);
            }
            return true;
        }
    });
    var printables = [];
    for(var i=0; i<results.length; i++) {
        printables.push(printLog(results[i]));
    }
    return printables;
}

// Count number of log IDs
function getLogIDs() {
    var allids = [];
    var addedids = [];
    for(var i=0; i<logs.stream.length; i++) {
        try {
            if(!logs.stream[i].id && logs.stream[i].ch && !isNaN(logs.stream[i].ch) && addedids.indexOf("author-" + logs.stream[i].ch)==-1) {
                allids.push([null, [logs.stream[i].ch, bot.users.get("id", logs.stream[i].ch).username]]);
                addedids.push("author-" + logs.stream[i].ch);
            } else if(logs.stream[i].id=="General" && addedids.indexOf("General")==-1) {
                allids.push([["General", "General"], null]);
                addedids.push("General");
            } else if(logs.stream[i].id && !isNaN(logs.stream[i].id) && checkLogID(logs.stream[i].id) && !logs.stream[i].ch && addedids.indexOf("server-" + logs.stream[i].id)==-1) {
                allids.push([[logs.stream[i].id, bot.servers.get("id", logs.stream[i].id).name], null]);
                addedids.push("server-" + logs.stream[i].id);
            } else if(logs.stream[i].id && !isNaN(logs.stream[i].id) && checkLogID(logs.stream[i].id) && logs.stream[i].ch && !isNaN(logs.stream[i].ch) && addedids.indexOf("server-" + logs.stream[i].id)==-1 ) {
                allids.push([[logs.stream[i].id, bot.servers.get("id", logs.stream[i].id).name], [logs.stream[i].ch, bot.channels.get("id", logs.stream[i].ch).name]]);
                addedids.push("server-" + logs.stream[i].id);
            }
        } catch(err) {
            ;
        }
    }
    return allids;
}

// Ensure that a given log ID is safe to display
function checkLogID(id) {
    var svr = bot.servers.get("id", id);
    if(svr) {
        return configs.servers[svr.id].showsvr && configs.servers[svr.id].showpub;
    }
    return true;
}

// Check for updates
function checkVersion() {
    unirest.get("http://awesome.awesomebot.xyz/updates")
    .header("Accept", "application/json")
    .end(function(response) {
        try {
            if(!response.body || !response.body[0]) {
                logMsg(Date.now(), "ERROR", "General", null, "Failed to check for updates");
                return;
            }

            var info;
            var change = "";
            var v = "";
            if(version.indexOf("-M")==version.length-2) {
                v = version.substring(0, version.length-2)
            } else {
                v = version.slice(0);
            }
            if(response.body[0][0]!=v && response.body.indexOf(version)!=outOfDate) {
                if(version.indexOf("-M")==version.length-2 && response.body[0][0].indexOf("-M")!=response.body[0][0].length-2) {
                    return;
                }
                outOfDate = -1;
                for(var i=0; i<response.body.length; i++) {
                    if(response.body[i][0]==v) {
                        outOfDate = i;
                    }
                }
                if(outOfDate==-1) {
                    info = "many, many";
                } else {
                    if(response.body[outOfDate][1]) {
                        change = response.body[outOfDate][1];
                    }
                    info = outOfDate;
                }
                logMsg(Date.now(), "INFO", "General", null, "Found " + info + " new bot updates");
                var send = "There are " + info + " new update" + (info==1 ? "" : "s") + " available for " + bot.user.username;
                for(var i=0; i<outOfDate; i++) {
                    send += "\n\t" + (response.body[i][0] + "             ").slice(0,15);
                    if(response.body[i][1]) {
                        send += response.body[i][1];
                    }
                }
                send += "\nLearn more at http://awesomebot.xyz/";

                if(configs.maintainer && configs.maintainer!="") {
                    var usr = bot.users.get("id", configs.maintainer);
                    if(usr) {
                        bot.sendMessage(usr, send + "\nReply with `update` in the next 30 minutes to apply changes and shut down");
                        updateconsole = true;
                        setTimeout(function() {
                            updateconsole = false;
                        }, 1800000);
                        return;
                    }
                }
                logMsg(Date.now(), "WARN", "General", null, "Could not message bot maintainer about new updates");
            }
        } catch(error) {
            logMsg(Date.now(), "ERROR", "General", null, "Failed to check for updates");
        }
    });

    setTimeout(checkVersion, 10800000);
}

// Array comparison
Array.prototype.equals = function(array) {
    if(!array) {
        return false;
    }
    if(this.length!=array.length) {
        return false;
    }

    for(var i=0; i<this.length; i++) {
        if(this[i] instanceof Array && array[i] instanceof Array) {
            if(!this[i].equals(array[i])) {
                return false;
            }
        }  else if(this[i]!=array[i]) {
            return false;
        }
    }
    return true;
}

// Command-line setup for empty fields
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
function setup(i) {
    if(i<Object.keys(AuthDetails).length) {
        var key = Object.keys(AuthDetails)[i];
        if(!AuthDetails[key]) {
            rl.question("Enter " + key + ": ", function(input) {
                AuthDetails[key] = input;
                saveData("./auth.json", function(err) {
                    if(err) {
                        console.log("Error saving authentication details");
                        process.exit(1);
                    }
                    setup(++i);
                });
            });
        } else {
            setup(++i);
        }
    } else {
        switch(i) {
            case Object.keys(AuthDetails).length:
                if(!configs.maintainer && !configs.setup) {
                    rl.question("Enter your personal Discord ID or \".\" to skip: ", function(input) {
                        if(input==".") {
                            setup(++i);
                        } else {
                            configs.maintainer = input;
                            readyToGo = true;
                            setup(i+3);
                        }
                    });
                } else {
                    setup(i+3);
                }
                break;
            case Object.keys(AuthDetails).length+1:
                if(!configs.hosting && !configs.setup) {
                    rl.question("Enter the web interface URL or \".\" to skip: ", function(input) {
                        if(input==".") {
                            setup(++i);
                        } else {
                            configs.hosting = input;
                            setup(++i);
                        }
                    });
                } else {
                    setup(i+2);
                }
                break;
            case Object.keys(AuthDetails).length+2:
                if(!configs.game && !configs.setup) {
                    rl.question("Enter bot game or \".\" to skip: ", function(input) {
                        if(input==".") {
                            setup(++i);
                        } else {
                            configs.maintainer = input;
                            setup(++i);
                        }
                    });
                } else {
                    setup(++i);
                }
                break;
            default:
                rl.close();
                // Login to the bot's Discord account
                bot.loginWithToken(AuthDetails.token, function(loginError) {
                    if(loginError) {
                        console.log("Could not connect to Discord");
                        process.exit(1);
                    }
                    readyToGo = true;
                    configs.setup = true;
                });
                // Authenticate other modules
                imgur.setClientID(AuthDetails.imgur_client_id);
                wolfram = require("wolfram-node").init(AuthDetails.wolfram_app_id);
                googl.setKey(AuthDetails.google_api_key);
                unirest.get("https://openexchangerates.org/api/latest.json?app_id=" + AuthDetails.openexchangerates_app_id)
                .header("Accept", "application/json")
                .end(function(result) {
                    if(result.status==200) {
                        fx.rates = result.body.base;
                        fx.rates = result.body.rates;
                    }
                });
                break;
        }
    }
}
setup(0);

function handleBigError(err) {
    console.log(err.stack);
    logMsg(Date.now(), "ERROR", "General", null, "Something went seriously wrong: " + err);
    saveCSP();
    process.exit(1);
    return true;
}

domain.on("error", handleBigError);
process.on("uncaughtException", handleBigError);