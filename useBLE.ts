/* eslint-disable no-bitwise */
import { useMemo, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import {
	BleError,
	BleManager,
	Characteristic,
	Device,
} from 'react-native-ble-plx';
import * as ExpoDevice from 'expo-device';
import base64 from 'react-native-base64';

interface BluetoothLowEnergyApi {
	requestPermissions(): Promise<boolean>;
	scanForPeripherals(): void;
	connectToDevice: (deviceId: Device) => Promise<void>;
	disconnectFromDevice: () => void;
	connectedDevice: Device | null;
	allDevices: Device[];
	readCharacteristic: (
		serviceUUID: string,
		characteristicUUID: string
	) => Promise<string | null | undefined>;
	readableCharacteristics: ReadableCharacteristic[];
}

interface ReadableCharacteristic {
	service: string;
	characteristic: string;
}

function useBLE(): BluetoothLowEnergyApi {
	const bleManager = useMemo(() => new BleManager(), []);
	const [allDevices, setAllDevices] = useState<Device[]>([]);
	const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
	const [readableCharacteristics, setReadableCharacteristics] = useState<
		ReadableCharacteristic[]
	>([]);

	const requestAndroid31Permissions = async () => {
		const bluetoothScanPermission = await PermissionsAndroid.request(
			PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
			{
				title: 'Location Permission',
				message: 'Bluetooth Low Energy requires Location',
				buttonPositive: 'OK',
			}
		);
		const bluetoothConnectPermission = await PermissionsAndroid.request(
			PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
			{
				title: 'Location Permission',
				message: 'Bluetooth Low Energy requires Location',
				buttonPositive: 'OK',
			}
		);
		const fineLocationPermission = await PermissionsAndroid.request(
			PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
			{
				title: 'Location Permission',
				message: 'Bluetooth Low Energy requires Location',
				buttonPositive: 'OK',
			}
		);

		return (
			bluetoothScanPermission === 'granted' &&
			bluetoothConnectPermission === 'granted' &&
			fineLocationPermission === 'granted'
		);
	};

	const requestPermissions = async () => {
		if (Platform.OS === 'android') {
			if ((ExpoDevice.platformApiLevel ?? -1) < 31) {
				const granted = await PermissionsAndroid.request(
					PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
					{
						title: 'Location Permission',
						message: 'Bluetooth Low Energy requires Location',
						buttonPositive: 'OK',
					}
				);
				return granted === PermissionsAndroid.RESULTS.GRANTED;
			} else {
				const isAndroid31PermissionsGranted =
					await requestAndroid31Permissions();

				return isAndroid31PermissionsGranted;
			}
		} else {
			return true;
		}
	};

	const isDuplicteDevice = (devices: Device[], nextDevice: Device) =>
		devices.findIndex((device) => nextDevice.id === device.id) > -1;

	const scanForPeripherals = () =>
		bleManager.startDeviceScan(null, null, (error, device) => {
			if (error) {
				console.log(error);
			}
			if (device && device.name?.includes('CASIO GM-B2100')) {
				setAllDevices((prevState: Device[]) => {
					if (!isDuplicteDevice(prevState, device)) {
						return [...prevState, device];
					}
					return prevState;
				});
			}
		});

	const connectToDevice = async (device: Device) => {
		console.log('usao');
		try {
			const deviceConnection = await bleManager.connectToDevice(device.id);
			// console.log(deviceConnection);
			setConnectedDevice(deviceConnection);
			const res =
				await deviceConnection.discoverAllServicesAndCharacteristics();
			// console.log(res);
			const services = await deviceConnection.services();
			console.log('Services:', services);

			for await (const service of services) {
				const characteristics = await service.characteristics();
				for await (const characteristic of characteristics) {
					if (characteristic.isReadable) {
						console.log('Characteristic is readable');
						const readable = {
							service: service.uuid,
							characteristic: characteristic.uuid,
						};
						setReadableCharacteristics((prevCharacteristics) => [
							...prevCharacteristics,
							readable,
						]);
					}
				}
			}
			bleManager.stopDeviceScan();
		} catch (e) {
			console.log('FAILED TO CONNECT', e);
		}
	};

	async function readCharacteristic(
		serviceUUID: string,
		characteristicUUID: string
	) {
		try {
			// console.log(serviceUUID, characteristicUUID);
			// Read the characteristic value
			const characteristic =
				(await connectedDevice?.readCharacteristicForService(
					serviceUUID,
					characteristicUUID
				)) as Characteristic;
			console.log(characteristic.value);

			if (!characteristic.value) {
				console.error('Characteristic value is null');
				return null;
			}

			console.log('decode start');
			// Decode the base64 value to human-readable format
			const decodedValue = base64.decode(characteristic.value);
			console.log('decode end');

			console.log('Read value:', decodedValue);
			return decodedValue;
		} catch (error) {
			console.error('Error reading characteristic:', error);
		}
	}

	const disconnectFromDevice = () => {
		if (connectedDevice) {
			bleManager.cancelDeviceConnection(connectedDevice.id);
			setConnectedDevice(null);
		}
	};

	return {
		scanForPeripherals,
		requestPermissions,
		connectToDevice,
		allDevices,
		connectedDevice,
		disconnectFromDevice,
		readCharacteristic,
		readableCharacteristics,
	};
}

export default useBLE;
