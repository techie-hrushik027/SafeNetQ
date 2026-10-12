import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import type { FaultLog, PzemMetrics, ZmctMetrics, SystemState, TelemetryPoint } from '../types/dashboard';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const socket = io(apiUrl, { reconnection: true, reconnectionAttempts: Infinity });

export function useTelemetry() {
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [logs, setLogs] = useState<FaultLog[]>([]);
    const [systemStatus, setSystemStatus] = useState<SystemState>('NORMAL');
    const [relayState, setRelayState] = useState<boolean>(false);
    const [rmsHistory, setRmsHistory] = useState<TelemetryPoint[]>([]);

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

    const handleIncomingData = (data: any) => {
        console.log("📥 SOCKET PAYLOAD RECEIVED:", data);
        if (!data) return;

        const telemetry = data.telemetry ?? data;
        const now = data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
        const numeric = (value: unknown, fallback: number) => {
            const parsed = Number(value);
            return value !== null && value !== undefined && Number.isFinite(parsed) ? parsed : fallback;
        };
        const rmsVal = numeric(telemetry.rms_current ?? telemetry.current_rms ?? telemetry.rmsCurrent, 0);
        const voltageVal = numeric(telemetry.voltage, 0);
        const powerVal = numeric(telemetry.real_power ?? telemetry.realPower, 0);
        const energyVal = numeric(telemetry.energy, 0);
        const freqVal = numeric(telemetry.frequency, 0);
        const pfVal = numeric(telemetry.power_factor ?? telemetry.powerFactor, 0);

        const peakVal = numeric(telemetry.peak_current ?? telemetry.peakCurrent, 0);
        const cfVal = numeric(telemetry.crest_factor ?? telemetry.crestFactor, 0);
        const didtVal = numeric(telemetry.di_dt ?? telemetry.diDt, 0);
        const reportedStatus = data.status ?? data.inference?.fault_status ?? data.fault_status;
        const validStatuses: SystemState[] = ['NORMAL', 'OVERCURRENT', 'SHORT_CIRCUIT', 'HIF'];
        if (validStatuses.includes(reportedStatus)) setSystemStatus(reportedStatus);
        const relay = data.relay_state ?? data.device_state?.relay_state ?? data.device_state?.relayState;
        if (relay !== undefined) setRelayState(relay === 1 || relay === true || relay === 'TRIPPED');

        setRmsHistory(prev => {
            const newHistory = [...prev, { time: now, rmsCurrent: rmsVal }];
            return newHistory.slice(-30);
        });

        setZmctData(prev => ({
            peakCurrent: { ...prev.peakCurrent, value: Number(peakVal), history: [...prev.peakCurrent.history, { val: Number(peakVal) }].slice(-10) },
            crestFactor: { ...prev.crestFactor, value: Number(cfVal), history: [...prev.crestFactor.history, { val: Number(cfVal) }].slice(-10) },
            diDt: { ...prev.diDt, value: Number(didtVal), history: [...prev.diDt.history, { val: Number(didtVal) }].slice(-10) }
        }));

        setPzemData(prev => ({
            voltage: { ...prev.voltage, value: Number(voltageVal), history: [...prev.voltage.history, { val: Number(voltageVal) }].slice(-10) },
            realPower: { ...prev.realPower, value: Number(powerVal), history: [...prev.realPower.history, { val: Number(powerVal) }].slice(-10) },
            energy: { ...prev.energy, value: Number(energyVal), history: [...prev.energy.history, { val: Number(energyVal) }].slice(-10) },
            frequency: { ...prev.frequency, value: Number(freqVal), history: [...prev.frequency.history, { val: Number(freqVal) }].slice(-10) },
            powerFactor: { ...prev.powerFactor, value: Number(pfVal), history: [...prev.powerFactor.history, { val: Number(pfVal) }].slice(-10) }
        }));
    };

    useEffect(() => {
        fetch(`${apiUrl}/api/faults`)
            .then(response => response.ok ? response.json() : [])
            .then((rows: any[]) => setLogs(rows.map(row => ({
                id: row.id,
                timestamp: row.timestamp,
                type: row.fault_type,
                rmsCurrent: Number(row.peak_current_amps ?? 0),
                crestFactor: Number(row.crest_factor ?? 0),
                diDt: Number(row.di_dt ?? 0),
                actionTaken: row.action_taken
            }))))
            .catch(error => console.error('Error fetching fault history:', error));

        socket.on('connect', () => setIsConnected(true));
        socket.on('disconnect', () => setIsConnected(false));

        // Listen to ALL common event names to prevent event mismatch
        socket.on('telemetry_update', handleIncomingData);
        socket.on('telemetry', handleIncomingData);
        socket.on('data', handleIncomingData);
        socket.on('mqtt_message', handleIncomingData);

        return () => {
            socket.off('connect');
            socket.off('disconnect');
            socket.off('telemetry_update', handleIncomingData);
            socket.off('telemetry', handleIncomingData);
            socket.off('data', handleIncomingData);
            socket.off('mqtt_message', handleIncomingData);
        };
    }, []);

    return { isConnected, logs, systemStatus, relayState, rmsHistory, pzemData, zmctData };
}
