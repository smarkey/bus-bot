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
			"T1",
			"M1"
		],
		pollFrequency: {
			low: 1,
			medium: 5,
			high: 10,
			extraHigh: 15
		},
		timing: {
			imminent: 5,
			soon: 15,
			distant: 30
		},
		walkingTime: 5,
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
				var buses = app.actions.getServicesFromResponse(response);

				if(buses !== null && typeof buses[0] !== "undefined") {
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
		getServicesFromResponse: function(response) {
			var key = $('#service').val();
			var map = response.departures;
			var result = null;

			// Hack required because using nextbus flag on request means m1 changes to M1
			if(typeof map[key.toLowerCase()] !== "undefined") {
				result = map[key.toLowerCase()];
			}

			if(typeof map[key.toUpperCase()] !== "undefined") {
				result = map[key.toUpperCase()];
			}

			return result;
		},
		getTimetablesUrl: function(nextBus) {
			return app.config.baseUrl + "/uk/bus/stop/" + $('#location').val() + "/live.json?" + 
					"app_id=" + app.config.appId + 
					"&app_key=" + app.config.appKey +
					`&nextbus=${nextBus ? 'yes' : 'no'}` +
					"&limit=10";
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

			if(expected.isAfter(scheduled)) 	return `${message} late by ${expected.from(scheduled, 'm')}.`;
			if(expected.isBefore(scheduled)) 	return `${message} early by ${scheduled.from(expected, 'm')}.`;
			return `${message} on time.`;
		},
		getAdviceMessage: function(expected) {
			var timeToLeave = expected.clone().subtract(app.config.walkingTime, 'm');

			if(timeToLeave.isSameOrBefore(moment())) 	return `It's unlikely you'll catch this bus ${expected.clone().fromNow()}.`;
			return `You should leave ${timeToLeave.fromNow()}.`;
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

				var now = moment();
				var time = now.format(moment.HTML5_FMT.TIME);
				var buses = app.actions.getServicesFromResponse(response);

				if(buses !== null && typeof buses[0] !== "undefined") {
					var bus = app.actions.getAllBusesDepartingAfter($('#time').val(), buses)[0];
					var scheduled = moment(`${bus.date} ${bus.aimed_departure_time}`);
					var expected = moment(`${bus.date} ${bus.best_departure_estimate}`);
					
					var message = app.actions.getMessage(scheduled, expected)
					console.log(`[${time}] ${message}`);

					if(expected.diff(now, 'm') < app.config.walkingTime || expected.diff(now, 'm') > 30) {
						$('#status').append(`<img src="mute.svg" class="mute"><b>[${time}]</b> ${message}<br/>`);
					} else {
						$('#status').append(`<b>[${time}]</b> ${message}<br/>`);
						app.actions.saySomething(message);
					}

					app.config.timeout = setTimeout(app.actions.start, app.actions.getPollFrequency(now, expected));
				} else {
					var message = `There are no buses for the ${$('#service').val()}`;
					console.log(`[${time}] ${message}`);

					$('#start, #stop').toggle();
				}
			});
		},
		getPollFrequency: function(now, expected) {
			var timings = app.config.timing;
			var frequencies = app.config.pollFrequency;
			var walkingTime = app.config.walkingTime;
			var minutesToLeave = expected.diff(now, 'm') - walkingTime;

			if(minutesToLeave > timings.distant) 	return frequencies.extraHigh * 60000;
			if(minutesToLeave > timings.soon) 		return frequencies.high * 60000;
			if(minutesToLeave > timings.imminent) 	return frequencies.medium * 60000;
			return frequencies.low * 60000;
		}
	}
}
