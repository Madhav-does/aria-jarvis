/**
 * J.A.R.V.I.S. / A.R.I.A Simulated Arduino Hardware Engine
 * Replicates the ATmega328P microcontroller state, delay timings (20-60ms),
 * and thermal telemetry for climate appliances.
 */

class SimulatedArduino {
  constructor() {
    this.state = {
      LIGHT: false,      // D7
      FAN: false,        // D9
      MOTOR: false,      // D8
      AC: false,         // D10
      TV: false,         // D11
      HEATER: false,     // D12
      NIGHT_LAMP: false, // D6
      DOOR: false,       // D5: false = LOCKED, true = UNLOCKED
      CURTAINS: false,   // D4: false = CLOSED, true = OPEN
      MUSIC: false       // D3
    };

    this.acTemp = 28.0;
    this.heaterTemp = 24.0;
    this.disconnected = false;

    this.startThermalSimulation();
  }

  startThermalSimulation() {
    setInterval(() => {
      // AC cooling simulation
      if (this.state.AC) {
        if (this.acTemp > 22.0) this.acTemp = +(this.acTemp - 0.2).toFixed(1);
      } else {
        if (this.acTemp < 28.0) this.acTemp = +(this.acTemp + 0.1).toFixed(1);
      }

      // Heater warming simulation
      if (this.state.HEATER) {
        if (this.heaterTemp < 55.0) this.heaterTemp = +(this.heaterTemp + 0.6).toFixed(1);
      } else {
        if (this.heaterTemp > 24.0) this.heaterTemp = +(this.heaterTemp - 0.3).toFixed(1);
      }
    }, 1000);
  }

  getState() {
    return {
      ...this.state,
      acTemp: this.acTemp,
      heaterTemp: this.heaterTemp
    };
  }

  send(command) {
    return new Promise((resolve, reject) => {
      if (this.disconnected) {
        setTimeout(() => reject(new Error("TIMEOUT_NO_REPLY")), 850);
        return;
      }

      // 20ms to 60ms simulated serial bus latency
      const delay = Math.floor(Math.random() * 41) + 20;

      setTimeout(() => {
        let reply = "";

        if (command === 'ALL_ON') {
          for (let k in this.state) this.state[k] = true;
          reply = "ACK:ALL_ON";
        } else if (command === 'ALL_OFF') {
          for (let k in this.state) this.state[k] = false;
          reply = "ACK:ALL_OFF";
        } else if (command === 'STATUS') {
          const s = this.state;
          reply = `STATUS light=${s.LIGHT ? 'ON' : 'OFF'} fan=${s.FAN ? 'ON' : 'OFF'} motor=${s.MOTOR ? 'ON' : 'OFF'} ac=${s.AC ? 'ON' : 'OFF'} tv=${s.TV ? 'ON' : 'OFF'} heater=${s.HEATER ? 'ON' : 'OFF'} night_lamp=${s.NIGHT_LAMP ? 'ON' : 'OFF'} door=${s.DOOR ? 'UNLOCKED' : 'LOCKED'} curtains=${s.CURTAINS ? 'OPEN' : 'CLOSED'} music=${s.MUSIC ? 'ON' : 'OFF'}`;
        } else if (command === 'DOOR_LOCK') {
          this.state.DOOR = false;
          reply = "ACK:DOOR_LOCK";
        } else if (command === 'DOOR_UNLOCK') {
          this.state.DOOR = true;
          reply = "ACK:DOOR_UNLOCK";
        } else if (command === 'CURTAINS_OPEN') {
          this.state.CURTAINS = true;
          reply = "ACK:CURTAINS_OPEN";
        } else if (command === 'CURTAINS_CLOSE') {
          this.state.CURTAINS = false;
          reply = "ACK:CURTAINS_CLOSE";
        } else {
          const parts = command.split('_');
          const action = parts.pop();
          const dev = parts.join('_');

          if (this.state.hasOwnProperty(dev)) {
            this.state[dev] = (action === 'ON');
            reply = `ACK:${command}`;
          } else {
            reply = "ERR:UNKNOWN";
          }
        }

        resolve({
          reply,
          state: this.getState()
        });
      }, delay);
    });
  }
}

module.exports = new SimulatedArduino();
