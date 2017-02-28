var slack = require('slack')
var bot = slack.rtm.client()
var env = require('node-env-file')
var channels = require('./channels')
var admins = require('./admins')

env(__dirname + '/.env')
var token = process.env.SLACK_TOKEN

// auto rejoin
bot.channel_left(function(msg) {
  var toJoin = channels.whitelist.find((chan) => {
    return chan.id === msg.channel && chan.always
  })
  if (toJoin !== undefined) {
    slack.channels.join(
      {token: token, name: toJoin.name}, (err, data) => {
        if (data) { console.log(`auto rejoined #${toJoin.name}`) }
        if (err) { console.log(err) }
      }
    )
  }
})

// auto leave
bot.channel_joined(function(msg) {
  if (channels.whitelist.find((chan) => {
    return chan.id === msg.channel.id
  }) === undefined) {
    slack.channels.leave(
      {token: token, channel: msg.channel.id}, (err, data) => {
        if (data) { console.log(`auto left #${msg.channel.name}`) }
        if (err) { console.log(err) }
      }
    )
  }
})

// list admins
function cmd_admins(arg) {
  var text = '<@' + arg.from + '>: ' +
    admins.reduce((str, user) => {return str + '<@' + user.name + '>\n'}, '')
  slack.chat.postMessage(
    {token: token, as_user: true, channel: arg.in, text: text}, (err, data) => {
      if (data) { console.log(`cmd_admins from ${arg.from} to ${arg.in}`) }
      if (err) { console.log(err) }
    }
  )
}

// list commands
function cmd_help(arg) {
  var text = '<@' + arg.from + '>: ' +
    '`!command[s]`,`!help`, \n' +
    '`!admin[s]`, \n' +
    '`!time`,`!date`, \n' +
    '`!libre <message>`, \n' +
    '`!lockpicking <message>`, \n' +
    '`!secu <message>`, \n' +
    '`!annonces <message>`'
  slack.chat.postMessage(
    {token: token, as_user: true, channel: arg.in, text: text}, (err, data) => {
      if (data) { console.log(`cmd_help from ${arg.from} to ${arg.in}`) }
      if (err) { console.log(err) }
    }
  )
}

// tell time and date
function cmd_time(arg) {
  var now = new Date()
  var text = `<@${arg.from}>: ${now.toDateString()} ${now.toTimeString()}`
  slack.chat.postMessage(
    {token: token, as_user: true, channel: arg.in, text: text}, (err, data) => {
      if (data) { console.log(`cmd_time from ${arg.from} to ${arg.in}`) }
      if (err) { console.log(err) }
    }
  )
}

// repeat with @channel
function cmd_announce(arg) {
  var text = `<!channel>: ${arg.message}\n(<@${arg.from}>)`
  slack.chat.postMessage(
    {token: token, as_user: true, channel: arg.to, text: text}, (err, data) => {
      if (data) { console.log(`cmd_announce to ${arg.to}\n${text}`) }
      if (err) { console.log(err) }
    }
  )
}

// commands
bot.message(function(msg) {
  var from = admins.find((user) => {
    return user.id === msg.user
  })
  if (from !== undefined) {
    if (msg.text.startsWith('!admin')) {
      cmd_admins({name: '!admin', from: from.name, in: msg.channel})
    }
    if (msg.text.startsWith('!command') || msg.text.startsWith('!help')) {
      cmd_help({name: '!help', from: from.name, in: msg.channel})
    }
    if (msg.text.startsWith('!time') || msg.text.startsWith('!date')) {
      cmd_time({name: '!time', from: from.name, in: msg.channel})
    }
    if (msg.text.startsWith('!secu ')) {
      cmd_announce({name: '!secu', from: from.name, to: '#asn-secu', message: msg.text.slice(6)})
    }
    if (msg.text.startsWith('!lockpicking ')) {
      cmd_announce({name: '!lockpicking', from: from.name, to: '#asn-lockpicking', message: msg.text.slice(13)})
    }
    if (msg.text.startsWith('!libre ')) {
      cmd_announce({name: '!libre', from: from.name, to: '#asn-libre', message: msg.text.slice(7)})
    }
    if (msg.text.startsWith('!annonces ')) {
      cmd_announce({name: '!annonces', from: from.name, to: '#annonces', message: msg.text.slice(6)})
    }
  }
})

// start listening to the slack team associated to the token
bot.listen({token:token})
