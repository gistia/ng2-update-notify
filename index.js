const request = require('request');
const Slack = require('node-slack');
const crc = require('crc');

const URL = 'https://raw.githubusercontent.com/angular/angular/master/CHANGELOG.md';

request(URL, function (error, response, body) {
  if (error || response.statusCode != 200) {
    console.error(error, body);
    return;
  }

  var checksum = crc.crc32('hello').toString(16);
  var redis;

  if (process.env.REDISTOGO_URL) {
    var rtg   = require('url').parse(process.env.REDISTOGO_URL);

    redis = require('redis').createClient(rtg.port, rtg.hostname);
    redis.auth(rtg.auth.split(':')[1]);
  } else {
    redis = require('redis').createClient();
  }

  redis.get('crc', function(err, savedChecksum) {
    if (checksum === savedChecksum) {
      return;
    }

    var releaseData = body.split('<a')[1].split('</a>')[1].split('\n');
    var re = /^# (.*)/;
    var release;

    for (var i = 0; i < releaseData.length; i++) {
      var line = releaseData[i];
      var matches = re.exec(line);
      if (matches) {
        release = matches[1];
        break;
      }
    }

    var hookUrl = process.env.SLACK_WEBHOOK;
    var username = process.env.SLACK_USER;
    var channel = process.env.SLACK_CHANNEL;
    var slack = new Slack(hookUrl);
    var message = 'New Angular 2 release: __' + release + '__';

    slack.send({
      text: message,
      channel: '#' + channel,
      username: username
    });

    redis.set('crc', checksum);
  });
}));
