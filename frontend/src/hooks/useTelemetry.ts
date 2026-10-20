import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import type { FaultLog, MetricData, PzemMetrics, ZmctMetrics, SystemState, TelemetryPoint } from '../types/dashboard';
const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:4000');

export function useTelemetry() {
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [logs, setLogs] = useState<FaultLog[]>([]);
    const [systemStatus, setSystemStatus] = useState<SystemState>('NORMAL');
    const [relayState, setRelayState] = useState<boolean>(false);
    const [rmsHistory, setRmsHistory] = useState<TelemetryPoint[]>([]);
    const [currentData, setCurrentData] = useState<MetricData>({
        label: 'Current',
        value: 0,
        unit: 'A',
        history: []
    });

    // Default Initial States for Metrics
    const [pzemData, setPzemData] = useState<PzemMetrics>({
        voltage: { label: 'Voltage', value: 0, unit: 'V', history: [] },
        realPower: { label: 'Real Power', value: 0, unit: 'W', history: [] },
        energy: { label: 'Energy', value: 0, unit: 'kWh', history: [] },
        frequency: { label: 'Frequency', value: 0, unit: 'Hz', history: [] },
        powerFactor: { label: 'Power Factor', value: 0, unit: '', history: [] }
    });

    const [zmctData, setZmctData] = useState<ZmctMetrics>({
        peakCurrent: { label: 'Peak Current', value: 0, unit: 'A', history: [] },
        crestFactor: { label: 'Crest Factor', value: 0, unit: '', history: [] },
        diDt: { label: 'di/dt', value: 0, unit: 'A/ms', history: [] }
    });

    useEffect(() => {
        const handleConnect = () => setIsConnected(true);
        const handleDisconnect = () => setIsConnected(false);

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        setIsConnected(socket.connected);

        // Fetch Historical Faults
        axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/faults`)
            .then(response => {
                const mappedLogs = response.data.map((log: any) => ({
                    id: log.id,
                    timestamp: log.timestamp,
                    type: log.fault_type,
                    rmsCurrent: log.peak_current_amps,
                    crestFactor: log.crest_factor,
                    diDt: log.di_dt,
                    actionTaken: log.action_taken
                }));
                setLogs(mappedLogs);
            })
            .catch(error => console.error("Error fetching faults:", error));

        // Listen for Live Telemetry
        socket.on('telemetry_update', (data) => {
            const timestamp = new Date().toISOString();
            const now = new Date(timestamp).toLocaleTimeString();
            const telemetry = data.telemetry ?? data;
            const readNumber = (...values: unknown[]): number | undefined => {
                const value = values.find(candidate => candidate !== undefined && candidate !== null && candidate !== '');
                if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
                if (typeof value === 'string') {
                    const parsed = Number(value);
                    return Number.isFinite(parsed) ? parsed : undefined;
                }
                return undefined;
            };

            const voltage = readNumber(telemetry.voltage);
            const realPower = readNumber(telemetry.real_power, telemetry.realPower);
            const energy = readNumber(telemetry.energy);
            const frequency = readNumber(telemetry.frequency);
            const powerFactor = readNumber(telemetry.power_factor, telemetry.powerFactor);
            const currentRms = readNumber(telemetry.rms_current, telemetry.current_rms, telemetry.currentRms);
            const peakCurrent = readNumber(telemetry.peak_current, telemetry.peakCurrent);
            const crestFactor = readNumber(telemetry.crest_factor, telemetry.crestFactor);
            const diDt = readNumber(telemetry.di_dt, telemetry.diDt);

            setSystemStatus(data.status ?? data.inference?.fault_status ?? 'NORMAL');
            setRelayState((data.relay_state ?? data.device_state?.relay_state) === 1);

            setRmsHistory(prev => {
                const newHistory = [...prev, { time: now, rmsCurrent: currentRms ?? 0 }];
                return newHistory.slice(-30);
            });

            if (currentRms !== undefined) {
                setCurrentData(prev => ({
                    ...prev,
                    value: currentRms,
                    history: [...prev.history, { val: currentRms }].slice(-10)
                }));
            }

            setZmctData(prev => ({
                peakCurrent: peakCurrent === undefined ? prev.peakCurrent : { ...prev.peakCurrent, value: peakCurrent, history: [...prev.peakCurrent.history, { val: peakCurrent }].slice(-10) },
                crestFactor: crestFactor === undefined ? prev.crestFactor : { ...prev.crestFactor, value: crestFactor, history: [...prev.crestFactor.history, { val: crestFactor, time: timestamp }].slice(-10) },
                diDt: diDt === undefined ? prev.diDt : { ...prev.diDt, value: diDt, history: [...prev.diDt.history, { val: diDt }].slice(-10) }
            }));

            setPzemData(prev => ({
                ...prev,
                voltage: voltage === undefined ? prev.voltage : { ...prev.voltage, value: voltage, history: [...prev.voltage.history, { val: voltage }].slice(-10) },
                realPower: realPower === undefined ? prev.realPower : { ...prev.realPower, value: realPower, history: [...prev.realPower.history, { val: realPower }].slice(-10) },
                energy: energy === undefined ? prev.energy : { ...prev.energy, value: energy, history: [...prev.energy.history, { val: energy }].slice(-10) },
                frequency: frequency === undefined ? prev.frequency : { ...prev.frequency, value: frequency, history: [...prev.frequency.history, { val: frequency }].slice(-10) },
                powerFactor: powerFactor === undefined ? prev.powerFactor : { ...prev.powerFactor, value: powerFactor, history: [...prev.powerFactor.history, { val: powerFactor }].slice(-10) }
            }));
        });

        return () => {
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
            socket.off('telemetry_update');
        };
    }, []);

    return { isConnected, logs, systemStatus, relayState, rmsHistory, pzemData, zmctData, currentData };
}
