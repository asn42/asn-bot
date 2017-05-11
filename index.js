const fs = require('fs')
const slack = require('slack')
const bot = slack.rtm.client()
const env = require('node-env-file')
const channels = require('./channels')
const admins = require('./admins')

env(__dirname + '/.env')
const token = process.env.SLACK_TOKEN

let lastTimeStamp
let myId

bot.started(function(payload) {
  lastTimeStamp = parseFloat(payload.latest_event_ts)
  myId = payload.self.id
})

const commands = []

// auto rejoin
bot.channel_left(function(msg) {
  const toJoin = channels.whitelist.find((chan) => {
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
  if (arg.from.isAdmin !== true) {
    return
  }
  if (arg.message === undefined) {
    const text = '<@' + arg.from.name + '>: ' +
      admins.map((admin) => {return '<@' + admin.name + '>'}).join('\n')
    slack.chat.postMessage(
      {token: token, as_user: true, channel: arg.in, text: text}, (err, data) => {
        if (data) { console.log(`cmd_admins from ${arg.from.name} to ${arg.in}`) }
        if (err) { console.log(err) }
      }
    )
  } else {
    const option = arg.message.match(/^(add|remove) ([^ ]+) *$/)
    if (option !== null) {
      if (option[1] === 'add' && arg.from.isOverlord === true) {
        const action = (user) => {
          const newAdmins = admins.slice()
          newAdmins.push({id: user.id, overloard: false, name: user.name})
          const adminsStr = 'const admins = '
            + JSON.stringify(newAdmins, undefined, 2)
            + '\n\nmodule.exports = admins'
          fs.writeFileSync('./admins.js', adminsStr, 'utf8')
        }
      } else if (option[1] === 'remove' && arg.from.isOverlord === true) {
        const action = (user) => {
          const newAdmins = admins.filter((u) => {
            return (u.id !== user.id && u.name !== user.name)
              || u.overlord === true
          })
          const adminsStr = 'const admins = '
            + JSON.stringify(newAdmins, undefined, 2)
            + '\n\nmodule.exports = admins'
          fs.writeFileSync('./admins.js', adminsStr, 'utf8');
        }
      }
      if (option[2].search(/^<@U[A-Z0-9]{8}>$/) !== -1) {
        slack.users.info(
          {token: token, user: option[2].substr(2,9)}, (err, resp) => {
            if (resp && resp.user) {
              action(resp.user)
            }
            if (err) { console.log(err) }
          })
      } else {
        slack.users.list(
          {token: token}, (err, resp) => {
            if (resp && resp.members) {
              const user = resp.members.find((member) => {
                return member.name === option[2]
              })
              action(user)
            }
            if (err) { console.log(err) }
          })
      }
    }
  }
}
commands.push({
  func: cmd_admins,
  names: ['!admins', '!admin'],
  description: 'Lists admins.\n'
  + 'Options: `add`/`remove` + nick to add or remove an admin.'
})

// list commands and print help messages
function cmd_help(arg) {
  if (arg.from.isAdmin !== true) {
    return
  }
  let text = '<@' + arg.from.name + '>:\n'
  if (arg.message === undefined) {
    text += 'usage: `!help [!command]`\n'
    text += commands.map((command) => {
      return command.names.join(', ')
    }).join('\n')
  } else {
    const cmd = commands.find((command) => {
      return command.names.includes(arg.message)
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
  if (arg.from.isAdmin !== true) {
    return
  }
  const now = new Date()
  const text = `<@${arg.from.name}>: ${now.toDateString()} ${now.toTimeString()}`
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
  if (arg.from.isAdmin !== true || arg.message == undefined) {
    return
  }
  const to = {
    '!annonces': '#annonces',
    '!asso': '#asn-',
    '!libre': '#asn-libre',
    '!lockpicking': '#asn-lockpicking',
    '!secu': '#asn-secu'
  }[arg.name]
  const text = `<!channel>: ${arg.message}\n(<@${arg.from.name}>)`
  slack.chat.postMessage(
    {token: token, as_user: true, channel: to, text: text}, (err, data) => {
      if (data) {
        console.log(`cmd_announce to ${to} | ${text}`)
        slack.pins.add(
          {token: token, channel: data.channel, timestamp: data.ts},
          (err, resp) => {
            if (resp) {
              console.log(' (pinned it)\n')
            }
          }
        )
      }
      if (err) { console.log(err) }
    }
  )
}
commands.push({
  func: cmd_announce,
  names: ['!annonces', '!asso', '!libre', '!lockpicking', '!secu'],
  description: 'Announcement on the specified channel '
  + '(#annonces, #asn-, #asn-libre, #asn-lockpicking or #asn-secu) '
  + 'with your nick at the end of the message.'
})

// commands
function onMessage(msg) {
  slack.users.info({token: token, user: msg.user}, (err, rawFrom) => {
    if (err) { console.log(err) }
    if (rawFrom && rawFrom.user) {
      if (rawFrom.user.id === myId) { return } // just in case
      const from = {id: rawFrom.user.id, name: rawFrom.user.name}
      const adm = admins.find((admin) => {return admin.id === rawFrom.user.id})
      from.isAdmin = (adm !== undefined) ? true : false
      from.isOverlord = (adm !== undefined) ? adm.overlord : false

      const matches = msg.text.match(/^(![a-z]+)(\s+|$)/)
      if (matches !== null) {
        const command = commands.find((command) => {
          return command.names.includes(matches[1])
        })
        if (command !== undefined) {
          const name = command.names.find((name) => {return name === matches[1]})
          if (name !== undefined) {
            command.func({
              name: matches[1],
              ts: msg.ts,
              from: from,
              in: msg.channel,
              message: msg.text.substr(matches[0].length)
            })
          }
        }
      }
    }
  })
}

// message events include many subtypes about topics, join/leave, files, etc.
// https://api.slack.com/events/message#message_subtypes
bot.message(function(msg) {
  // Don't process the same message twice
  if (lastTimeStamp && lastTimeStamp >= parseFloat(msg.ts)) {
    return
  } else {
    lastTimeStamp = parseFloat(msg.ts)
  }
  if (msg.subtype === undefined) {
    onMessage(msg)
  }
})

// callback on slack `listen` event
const listenCb = () => {
  bot.ws.on('close', (code, reason) => {
    console.log('' + new Date() + ' - WebSocket closed, reopening')
    bot.listen({token:token}, listenCb)
  })
}

// start listening to the slack team associated to the token
bot.listen({token:token}, listenCb)
