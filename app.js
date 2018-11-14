var app = {
	config: {
		appId: '141a4847',
		appKey: '3337324691d3130289115a0c723677ab',
		baseUrl: 'https://transportapi.com/v3',
		stops: {
			home: '017000052',
			work: '0100BRA16904'
		},
		services: [
			"T1"
		],
		walkingTime: 6,
		pollFrequencyLow: 120000,
		pollFrequencyMedium: 240000,
		pollFrequencyHigh: 600000,
		timeout: null
	},
	actions: {
		populateService: function() {
			$.each(app.config.services, function( index, service ) {
				$('#service').append(new Option(service, service));
			});
		},
		populateLocation: function() {
			$.each(app.config.stops, function( key, value ) {
				$('#location').append(new Option(key.charAt(0).toUpperCase() + key.slice(1), value));
			});
		},
		populateTime: function() {
			$.get(app.actions.getTimetablesUrl(false)).done( function(response) {
				var buses = response.departures[$('#service').val()];

				if(typeof buses !== "undefined" && typeof buses[0] !== "undefined") {
					$('#time').find('option').remove().end().prop('disabled', false);

					$.each(buses, function( index, bus ) {
						$('#time').append(new Option(bus.aimed_departure_time, bus.aimed_departure_time));
					});
					$('#start').prop('disabled', false);
				} else {
					$('#time').find('option').remove().end().prop('disabled', true).append(new Option("No Buses Scheduled", null));
					$('#start').prop('disabled', true);
				}
			});
		},
		getTimetablesUrl: function(nextBus) {
			return app.config.baseUrl + "/uk/bus/stop/" + $('#location').val() + "/live.json?" + 
					"app_id=" + app.config.appId + 
					"&app_key=" + app.config.appKey +
					`&nextbus=${nextBus ? 'yes' : 'no'}` +
					"&limit=20";
		},
		saySomething: function(text) {
			var msg = new SpeechSynthesisUtterance(text);
			msg.lang = 'en-GB';
			window.speechSynthesis.speak(msg);
		},
		getMessage: function(scheduled, expected) {
			var statusMessage = app.actions.getStatusMessage(scheduled, expected);
			var adviceMessage = app.actions.getAdviceMessage(expected);
			return `${statusMessage} ${adviceMessage}`;
		},
		getStatusMessage: function(scheduled, expected) {
			var scheduledTime = scheduled.format(moment.HTML5_FMT.TIME);
			var message = `The ${scheduledTime} is`;

			if(expected.isAfter(scheduled)) {
				return `${message} late by ${moment.duration(expected.diff(scheduled, 'm')).humanize()}.`;
			} else if(expected.isBefore(scheduled)) {
				return `${message} early by ${moment.duration(scheduled.diff(expected, 'm')).humanize()}.`;
			} else {
				return `${message} on time.`;
			}
		},
		getAdviceMessage: function(expected) {
			var timeToLeave = expected.subtract(app.config.walkingTime, 'm').fromNow();

			if(timeToLeave.indexOf("ago") !== -1) {
				return `It's unlikely you'll catch this bus in ${moment.duration(expected.minutes(), 'm').humanize()}`;
			} else {
				return `You should leave ${timeToLeave}.`;
			}
		},
		getAllBusesDepartingAfter: function(departureTime, buses) {
			return buses.filter(bus => 
				moment(`${bus.date} ${bus.aimed_departure_time}`)
					.isSameOrAfter(moment(`${bus.date} ${departureTime}`))
			);
		},
		start: function() {
			$.get(app.actions.getTimetablesUrl(true)).done( function(response) {
				$('#stopName').html(response.stop_name);

				var buses = response.departures[$('#service').val()];

				if(typeof buses !== "undefined" && typeof buses[0] !== "undefined") {
					var bus = app.actions.getAllBusesDepartingAfter($('#time').val(), buses)[0];
					var scheduled = moment(`${bus.date} ${bus.aimed_departure_time}`);
					var expected = moment(`${bus.date} ${bus.best_departure_estimate}`);

					app.actions.log(app.actions.getMessage(scheduled, expected));
					app.config.timeout = setTimeout(app.actions.start, app.actions.getPollFrequency(moment(), expected));
				} else {
					app.actions.log(`There are no buses for the ${$('#service').val()}`);
					$('#start, #stop').toggle();
				}
			});
		},
		getPollFrequency: function(now, expected) {
			var minutesUntilDeparture = expected.diff(now, 'm');

			if(minutesUntilDeparture < 10) {
				return app.config.pollFrequencyLow;
			} else if(minutesUntilDeparture < 20) {
				return app.config.pollFrequencyMedium;
			} else {
				return app.config.pollFrequencyHigh;
			}
		},
		log: function(message) {
			var time = moment().format(moment.HTML5_FMT.TIME);
			console.log(`[${time}] ${message}`);

			if(message.indexOf("It's unlikely you'll catch this bus in") !== -1 || message.indexOf("hour") !== -1) {
				$('#status').append(`<img src="mute.svg" class="mute"><b>[${time}]</b> ${message}<br/>`);
			} else {
				$('#status').append(`<b>[${time}]</b> ${message}<br/>`);
				app.actions.saySomething(message);
			}
		}
	}
}