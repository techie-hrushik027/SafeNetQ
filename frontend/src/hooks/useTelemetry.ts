import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import type { FaultLog, PzemMetrics, ZmctMetrics, SystemState, TelemetryPoint } from '../types/dashboard';
const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:4000');

export function useTelemetry() {
    const [logs, setLogs] = useState<FaultLog[]>([]);
    const [systemStatus, setSystemStatus] = useState<SystemState>('NORMAL');
    const [relayState, setRelayState] = useState<boolean>(false);
    const [rmsHistory, setRmsHistory] = useState<TelemetryPoint[]>([]);

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
            const now = new Date().toLocaleTimeString();

            setSystemStatus(data.status);
            setRelayState(data.relay_state === 1);

            setRmsHistory(prev => {
                const newHistory = [...prev, { time: now, rmsCurrent: data.rms_current || 0 }];
                return newHistory.slice(-30);
            });

            setZmctData(prev => ({
                peakCurrent: { ...prev.peakCurrent, value: data.peak_current, history: [...prev.peakCurrent.history, { val: data.peak_current }].slice(-10) },
                crestFactor: { ...prev.crestFactor, value: data.crest_factor, history: [...prev.crestFactor.history, { val: data.crest_factor }].slice(-10) },
                diDt: { ...prev.diDt, value: data.di_dt, history: [...prev.diDt.history, { val: data.di_dt }].slice(-10) }
            }));

            setPzemData(prev => ({
                ...prev,
                voltage: { ...prev.voltage, value: data.voltage || 230.2, history: [...prev.voltage.history, { val: data.voltage || 230.2 }].slice(-10) }
            }));
        });

        return () => {
            socket.off('telemetry_update');
        };
    }, []);

    return { logs, systemStatus, relayState, rmsHistory, pzemData, zmctData };
}