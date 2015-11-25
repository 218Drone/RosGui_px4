/*
px4GUI.js Version 1.0
author: shl
*/

// Set the rosbridge and mjpeg_server port
var rosbridgePort = "9090";
var mjpegPort = "8080";
// Get the current hostname
thisHostName = document.location.hostname;
// Set the rosbridge and mjpeg server hostname accordingly
var rosbridgeHost = thisHostName;
// Build the websocket URL to the rosbride server
var serverURL = "ws://" + rosbridgeHost + ":" + rosbridgePort;
// The default video topic (can be set in the rosbridge launch file)
var globalTopic = "/mavros/global_position/raw/fix";
var globalPositionTopic;
// The topic on which to publish Twist messages
var cmdVelTopic = "/mavros/setpoint_velocity/cmd_vel";
// The ROS namespace containing parameters for this script
var param_ns = '/robot_gui';

// Are we on a touch device?
var isTouchDevice = 'ontouchstart' in document.documentElement;
// A flag to indicate when the Shift key is being depressed
// The Shift key is used as a "dead man's switch" when using the mouse
// to control the motion of the robot.
var shiftKey = false;

// The rate in Hz for the main ROS publisher loop
var rate = 5;
//The main ROS object
var ros = new ROSLIB.Ros();

// Current desired linear and angular speed
var vx = 0.0;
var vy = 0.0;
var vz = 0.0;
// How much to increment speeds with each key press
var vx_click_increment = 0.1;
var vy_click_increment = 0.1;
var vz_click_increment = 0.1;

//GPS
var currentLon = 0.0;
var currentLat = 0.0;
var currentAlt = 0.0;

//earth radius
var R = 6371000;
// Connect to ROS
function init_ros() {
	ros.connect(serverURL);
	
	// Set the rosbridge host and port values in the form
	document.getElementById("rosbridgeHost").value = rosbridgeHost;
	document.getElementById("rosbridgePort").value = rosbridgePort;
}

// If there is an error on the back end, an 'error' emit will be emitted.
ros.on('error', function(error) {
	console.log("Rosbridge Error: " + error);
});

// Wait until a connection is made before continuing
ros.on('connection', function() {
	console.log('Rosbridge connected.');
	
	//subcribe a topic gps topic
	globalPositionTopic = new ROSLIB.Topic({
		ros : ros,
		name :  globalTopic,
		messageType : "sensor_msgs/NavSatFix"
	});
	globalPositionTopic.subscribe(function(message){
		console.log('Received message on ' + globalPositionTopic.name + ': ' + message.longitude+' '+message.latitude+ ' ' + message.altitude);
		document.getElementById('lat').innerHTML=message.latitude;
		document.getElementById('lon').innerHTML=message.longitude;
		document.getElementById('alt').innerHTML=message.altitude;
		currentLon = message.longitude;
		currentLat = message.latitude;
		currentAlt = message.altitude;
	});

	
	document.addEventListener('keydown', function(e) {
		if (e.shiftKey)
			shiftKey = true;
		else
			shiftKey = false;
		setSpeed(e.keyCode);
	}, true);

	document.addEventListener('keyup', function(e) {
		if (!e.shiftKey) {
			shiftKey = false;
			stopRobot();
		}
	}, true);	

	// Start the publisher loop
	console.log("Starting publishers");
	pubHandle = setInterval(refreshPublishers, 1000 / rate);

});

//public velocity
var cmdVelPub = new ROSLIB.Topic({
	ros : ros,
	name : cmdVelTopic,
	messageType : 'geometry_msgs/TwistStamped'
});


// Speed control using the arrow keys or icons
function setSpeed(code) {
	// Stop if the deadman key (Shift) is not depressed
	if (!shiftKey && !isTouchDevice) {
		stopRobot();
		return;
	}

	// Use space bar as an emergency stop
	if (code == 32) {
		vx = 0;
		vy = 0;
		vz = 0;
	}
	// Left arrow
	else if (code == "left") {
		vy += vy_click_increment;
	}
	// Up arrow
	else if (code == 'forward') {
		vx += vx_click_increment;
	}
	// Right arrow
	else if (code == 'right') {
		vy -= vy_click_increment;
	}
	// Down arrow
	else if (code == 'backward') {
		vx -= vx_click_increment;
	}

	//UP
	else if (code == 'up') {
		vz += vz_click_increment;
	}

	//DOWN
	else if (code == 'down') {
		vz -= vz_click_increment;
	}
}

function stopRobot() {
	vx = vy = vz = 0;
	writeStatusMessage(vx,vy,vz);
	pubCmdVel();
}
//always public the velocity  topic
function refreshPublishers() {
	// Keep the /cmd_vel messages alive
	pubCmdVel();
		
}

function pubCmdVel() {
	// vx = Math.min(Math.abs(vx), maxLinearSpeed) * sign(vx);
	// vz = Math.min(Math.abs(vz), maxAngularSpeed) * sign(vz);

	if (isNaN(vx) || isNaN(vz) || isNaN(vy)) {
		vx = 0;
		vz = 0;
		vy = 0;
	}

	var cmdVelMsg = new ROSLIB.Message({
		header : {
			frame_id : "velocity"
		},
		twist : {
			linear : {
				x : vx,
				y : vy,
				z : vz
			},
			angular : {
				x : 0.0,
				y : 0.0,
				z : 0.0
			}
		}
	});
	
	// var statusMessage = "vx: " + vx.toFixed(2) + " vz: " + vz.toFixed(2);
	writeStatusMessage(vx, vy,vz);

	cmdVelPub.publish(cmdVelMsg);
}

function writeStatusMessage(vx, vy, vz) {
	document.getElementById("vx").innerHTML=vx;
	document.getElementById("vy").innerHTML=vy;
	document.getElementById("vz").innerHTML=vz;
}

function takeoffBtn () {
	// body...
	//call service 
	var takeoffService = new ROSLIB.Service({
		ros : ros,
		name : '/mavros/cmd/takeoff',
		serviceType : "mavros_msgs/CommandTOL"
	});

	var takeoffRequest = new ROSLIB.ServiceRequest({
		min_pitch  : 0,
		yaw : 0,
		latitude : 55.7530147,
		longitude : 37.6273584,
		altitude : 10
	});
	takeoffService.callService(takeoffRequest, function  (result) {
		console.log("call takeoff service !!")
	});
}

function landingBtn () {
	// body...
	//call service 
	var landService = new ROSLIB.Service({
		ros : ros,
		name : '/mavros/cmd/land',
		serviceType : "mavros_msgs/CommandTOL"
	});

	var landRequest = new ROSLIB.ServiceRequest({
		min_pitch  : 0,
		yaw : 0,
		latitude : 55.7530147,
		longitude : 37.6273584,
		altitude : 0
	});
	landService.callService(landRequest, function  (result) {
		console.log("call land service !!")
	});
}

function armingBtn () {
	// body...
	var armingService = new ROSLIB.Service({
		ros : ros,
		name : '/mavros/cmd/arming',
		serviceType : "mavros_msgs/CommandBool"
	});

	var armingRequest = new ROSLIB.ServiceRequest({
		value : true
	});
	armingService.callService(armingRequest, function  (result) {
		console.log("call arming service !!")
	});
}

function landingBtn(){
	var armingService = new ROSLIB.Service({
		ros : ros,
		name : '/mavros/cmd/arming',
		serviceType : "mavros_msgs/CommandBool"
	});

	var armingRequest = new ROSLIB.ServiceRequest({
		value : false
	});
	armingService.callService(armingRequest, function  (result) {
		console.log("call disarm service !!")
	});
}
function setPoint() {
	// body...
	var setPointLon = document.getElementById("setPointLon").value;
	var  setPointLat = document.getElementById("setPointLat").value;
	if(setPointLat != null && setPointLon != null){
		console.log(setPointLon);
		console.log(setPointLat);
		while(true){
			var delta_x = R * (lat - currentLat) * (3.1415926535898 / 180);
			var delta_y = R * (lon - currentLon) * (3.1415926535898 / 180);
			vx = delta_x*0.1;;
			vy = -delta_y*0.1;
			vz = 0;
			writeStatusMessage(vx,vy,vz);
			pubCmdVel();
		}
	}
}