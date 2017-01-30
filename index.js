var slack = require('slack')
var bot = slack.rtm.client()
var env = require('node-env-file')

env(__dirname + '/.env')
var token = process.env.SLACK_TOKEN

var channels = [
  {id: 'C039P7U6E', always: true,  name: 'annonce'},
  {id: 'C3T7LJB1S', always: true,  name: 'asn-libre'},
  {id: 'C3SDZFG8Y', always: true,  name: 'asn-lockpicking'},
  {id: 'C3SES169F', always: true,  name: 'asn-secu'},
  {id: 'C3QG85SG6', always: false, name: 'general'}
]

var admins = [
  {id: 'U0GQXP468', overlord: true,  name: 'pk'},
  {id: 'U0FSDKUSZ', overlord: false, name: 'dbourdon'},
  {id: 'U2JEH63RB', overlord: false, name: 'lbenamer'},
  {id: 'U0BS3SQAC', overlord: false, name: 'tet'},
  {id: 'U047JPZG0', overlord: false, name: 'sle-guil'},
  {id: 'U3T4Q0J0P', overlord: false, name: 'el_famoso_sneaky'}
]

// auto rejoin
bot.channel_left(function(msg) {
  var toJoin = channels.find((chan) => {
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
  if (channels.find((chan) => {
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
function cmd_admins(from, to) {
  var text = '<@' + from + '>: ' +
    admins.reduce(function (str, user) {return str + '<@' + user.name + '>\n'}, '')
  slack.chat.postMessage(
    {token: token, as_user: true, channel: to, text: text}, (err, data) => {
      if (data) { console.log(`cmd_admins from ${from} to ${to}`) }
      if (err) { console.log(err) }
    }
  )
}

// list commands
function cmd_commands(from, to) {
  var text = '<@' + from + '>: ' +
    '`!command[s]`,`!help`, \n' +
    '`!admin[s]`, \n' +
    '`!time`,`!date`, \n' +
    '`!libre <message>`, \n' +
    '`!lockpicking <message>`, \n' +
    '`!secu <message>`, \n' +
    '`!annonces <message>`'
  slack.chat.postMessage(
    {token: token, as_user: true, channel: to, text: text}, (err, data) => {
      if (data) { console.log(`cmd_commands from ${from} to ${to}`) }
      if (err) { console.log(err) }
    }
  )
}

// tell time and date
function cmd_time(from, to) {
  var now = new Date()
  var text = `<@${from}>: ${now.toDateString()} ${now.toTimeString()}`
  slack.chat.postMessage(
    {token: token, as_user: true, channel: to, text: text}, (err, data) => {
      if (data) { console.log(`cmd_time from ${from} to ${to}`) }
      if (err) { console.log(err) }
    }
  )
}

// repeat with @channel
function cmd_announce(from, to, message) {
  var text = `<!channel>: ${message}\n(<@${from}>)`
  slack.chat.postMessage(
    {token: token, as_user: true, channel: to, text: text}, (err, data) => {
      if (data) { console.log(`cmd_announce to ${to}\n${text}`) }
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
      cmd_admins(from.name, msg.channel)
    }
    if (msg.text.startsWith('!command') || msg.text.startsWith('!help')) {
      cmd_commands(from.name, msg.channel)
    }
    if (msg.text.startsWith('!time') || msg.text.startsWith('!date')) {
      cmd_time(from.name, msg.channel)
    }
    if (msg.text.startsWith('!secu ')) {
      cmd_announce(from.name, '#asn-secu', msg.text.slice(6))
    }
    if (msg.text.startsWith('!lockpicking ')) {
      cmd_announce(from.name, '#asn-lockpicking', msg.text.slice(13))
    }
    if (msg.text.startsWith('!libre ')) {
      cmd_announce(from.name, '#asn-libre', msg.text.slice(7))
    }
    if (msg.text.startsWith('!annonces ')) {
      cmd_announce(from.name, '#annonces', msg.text.slice(6))
    }
  }
})

// start listening to the slack team associated to the token
bot.listen({token:token})
