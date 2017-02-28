var slack = require('slack')
var bot = slack.rtm.client()
var env = require('node-env-file')
var channels = require('./channels')
var admins = require('./admins')

env(__dirname + '/.env')
var token = process.env.SLACK_TOKEN

var commands = []

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
  var text = '<@' + arg.from.name + '>: ' +
    admins.map((admin) => {return '<@' + admin.name + '>'}).join('\n')
  slack.chat.postMessage(
    {token: token, as_user: true, channel: arg.in, text: text}, (err, data) => {
      if (data) { console.log(`cmd_admins from ${arg.from.name} to ${arg.in}`) }
      if (err) { console.log(err) }
    }
  )
}
commands.push({
  func: cmd_admins,
  names: ['!admins', '!admin'],
  description: 'Lists admins.\n'
  + 'Options: `add`/`remove` + nick to add or remove an admin.'
})

// list commands and print help messages
function cmd_help(arg) {
  var text = '<@' + arg.from.name + '>: '
  if (arg.message === undefined) {
    text += commands.map((command) => {
      return command.names.join(', ')
    }).join('\n')
  } else {
    var cmd = commands.find((command) => {
      return command.names.includes(arg.name)
    })
    if (cmd !== undefined) {
      text += cmd.names.join(', ') + '\n' + cmd.description
    } else {
      text += 'Command not recognized.'
    }
  }
  slack.chat.postMessage(
    {token: token, as_user: true, channel: arg.in, text: text}, (err, data) => {
      if (data) { console.log(`cmd_help from ${arg.from.name} to ${arg.in}`) }
      if (err) { console.log(err) }
    }
  )
}
commands.push({
  func: cmd_help,
  names: ['!help', '!command', '!commands'],
  description: 'Lists commands. Add a command name for more specific help.'
})

// tell time and date
function cmd_time(arg) {
  var now = new Date()
  var text = `<@${arg.from.name}>: ${now.toDateString()} ${now.toTimeString()}`
  slack.chat.postMessage(
    {token: token, as_user: true, channel: arg.in, text: text}, (err, data) => {
      if (data) { console.log(`cmd_time from ${arg.from.name} to ${arg.in}`) }
      if (err) { console.log(err) }
    }
  )
}
commands.push({
  func: cmd_time,
  names: ['!time', '!date'],
  description: 'Prints the current date and time.'
})

// repeat with @channel
function cmd_announce(arg) {
  var text = `<!channel>: ${arg.message}\n(<@${arg.from.name}>)`
  slack.chat.postMessage(
    {token: token, as_user: true, channel: arg.to, text: text}, (err, data) => {
      if (data) { console.log(`cmd_announce to ${arg.to}\n${text}`) }
      if (err) { console.log(err) }
    }
  )
}
commands.push({
  func: cmd_announce,
  names: ['!annonces', '!libre', '!lockpicking', '!secu'],
  description: 'Annoncement on the specified channel '
  + '(#annonces, #libre, #lockpicking or #secu) '
  + 'with your nick at the end of the message.'
})

// commands
bot.message(function(msg) {
  var from = admins.find((user) => {
    return user.id === msg.user
  })
  if (from !== undefined) {
    if (msg.text.startsWith('!admin')) {
      cmd_admins({name: '!admin', from: {name: from.name}, in: msg.channel})
    }
    if (msg.text.startsWith('!command') || msg.text.startsWith('!help')) {
      cmd_help({name: '!help', from: {name: from.name}, in: msg.channel})
    }
    if (msg.text.startsWith('!time') || msg.text.startsWith('!date')) {
      cmd_time({name: '!time', from: {name: from.name}, in: msg.channel})
    }
    if (msg.text.startsWith('!secu ')) {
      cmd_announce({name: '!secu', from: {name: from.name}, to: '#asn-secu', message: msg.text.slice(6)})
    }
    if (msg.text.startsWith('!lockpicking ')) {
      cmd_announce({name: '!lockpicking', from: {name: from.name}, to: '#asn-lockpicking', message: msg.text.slice(13)})
    }
    if (msg.text.startsWith('!libre ')) {
      cmd_announce({name: '!libre', from: {name: from.name}, to: '#asn-libre', message: msg.text.slice(7)})
    }
    if (msg.text.startsWith('!annonces ')) {
      cmd_announce({name: '!annonces', from: {name: from.name}, to: '#annonces', message: msg.text.slice(6)})
    }
  }
})

// start listening to the slack team associated to the token
bot.listen({token:token})
