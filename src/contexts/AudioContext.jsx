import { useEffect, useRef, useState, createContext, useContext } from "react";
import NoiseModule from '../utils/noise'


const AudioUtilsContext = createContext()

export const AudioProvider = ({ children }) => {
    const [inputDevices, setInputDevices] = useState([]);
    const [outputDevices, setOutputDevices] = useState([]);
    const [selectedInput, setSelectedInput] = useState('');
    const [selectedOutput, setSelectedOutput] = useState('');

    const ctx_mainRef = useRef(null);
    const blankStreamRef = useRef(null);
    const [localStream, setLocalStream] = useState(null);
    const nodesRef = useRef({
        sourceNode: null,
        gainNode: null,
        processorNode: null,
        mergerNode: null,
        analyser: null,
        handleAddonDataNode: null,
        addonGainNode: null,
        addonDestinationNode: null,
        destinationNode: null,
    })
    const [selfAudioActive, setSelfAudioActive] = useState(false)
    const selfAnimationFramesRef = useRef(null)
    const [inputVolume, setInputVolume] = useState(1);
    const [outputVolume, setOutputVolume] = useState(1);
    const [addonGain, setAddonGain] = useState(1);
    const localAudioCanvasRef = useRef(null);
    const localAudioRef = useRef(null);
    const localVisualizerRef = useRef(null);
    const [finalStream, setFinalStream] = useState(null);
    const [addonStream, setAddonStream] = useState(null);

    const [isWorkletRegistered, setIsWorkletRegistered] = useState(false);
    const [audioProcesses, setAudioProcesses] = useState([])
    const [captureProcess, setCaptureProcess] = useState(null)

    const bufferLengthRef = useRef(null);
    const processorIntervalRef = useRef(null);
    const [intervalMs, setIntervalMs] = useState(500)


    const stopAllTracks = (stream) => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    };

    //init default audio stream
    useEffect(() => {
        //initialize audiocontext
        ctx_mainRef.current = new AudioContext()

        //start with default input and output devices
        const setLocalAudioStream = async () => {
            stopAllTracks(localStream);
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                //console.log(stream);
            } catch (err) {
                console.error("Error accessing microphone:", err.message);
                const emptyAudioContext = new (window.AudioContext || window.webkitAudioContext)();
                const emptyAudioSource = emptyAudioContext.createMediaStreamDestination();
                stream = new MediaStream([emptyAudioSource.stream.getAudioTracks()[0]]);
            }
            setLocalStream(stream);
        }
        setLocalAudioStream();

        //enumerate input and output devices
        navigator.mediaDevices.enumerateDevices()
            .then(devices => {
                const inputList = [];
                const outputList = [];

                devices.forEach(device => {
                    if (device.kind === 'audioinput') {
                        inputList.push({ label: device.label, value: device.deviceId });
                    } else if (device.kind === 'audiooutput') {
                        outputList.push({ label: device.label, value: device.deviceId });
                    }
                });

                setInputDevices(inputList);
                setOutputDevices(outputList);

                if (inputList.length > 0) {
                    setSelectedInput(inputList[0].value);
                }
                if (outputList.length > 0) {
                    setSelectedOutput(outputList[0].value);
                }
            })
            .catch(error => {
                console.error("Error enumerating devices:", error);
            });
    }, [])

    //input selector onchange
    useEffect(() => {
        if (nodesRef.current.sourceNode && localStream) {
            stopAllTracks(localStream);
            navigator.mediaDevices.getUserMedia({
                audio: { deviceId: selectedInput },
                video: false
            })
                .then((newlocalStream) => {
                    setLocalStream(newlocalStream);

                    const ctx_main = ctx_mainRef.current
                    nodesRef.current.sourceNode.disconnect()
                    nodesRef.current.sourceNode = ctx_main.createMediaStreamSource(localStream)
                    nodesRef.current.sourceNode.connect(nodesRef.current.gainNode)

                })
        }
    }, [selectedInput])

    //output selector onchange
    useEffect(() => {
        if (localAudioRef.current) {
            try {
                localAudioRef.current.setSinkId(selectedOutput)
            }
            catch (error) {
                console.error('Error setting sink ID:', error);
            }
        }
    }, [selectedOutput])

    //input volume change
    useEffect(() => {
        if (nodesRef.current.gainNode) {
            nodesRef.current.gainNode.gain.value = inputVolume;
        }
    }, [inputVolume])

    //output volume change


    //init noise reduce node and connect audio process nodes
    useEffect(() => {
        const initNoiseReduceProcessorNode = (ctx) => {
            let Module;
            let frameBuffer = [];
            var inputBuffer = [];
            var outputBuffer = [];
            var bufferSize = 1024;
            function initializeNoiseSuppressionModule() {
                if (Module) {
                    return;
                }
                Module = {
                    noExitRuntime: true,
                    noInitialRun: true,
                    preInit: [],
                    preRun: [],
                    postRun: [
                        function () {
                            console.log(`Loaded Javascript Module OK`);
                        },
                    ],
                    memoryInitializerPrefixURL: "bin/",
                    arguments: ["input.ivf", "output.raw"],
                };
                NoiseModule(Module);
                Module.st = Module._rnnoise_create();
                Module.ptr = Module._malloc(480 * 4);
            }
            function removeNoise(buffer) {
                let ptr = Module.ptr;
                let st = Module.st;
                for (let i = 0; i < 480; i++) {
                    Module.HEAPF32[(ptr >> 2) + i] = buffer[i] * 32768;
                }
                Module._rnnoise_process_frame(st, ptr, ptr);
                for (let i = 0; i < 480; i++) {
                    buffer[i] = Module.HEAPF32[(ptr >> 2) + i] / 32768;
                }
            }
            const processorNode = ctx.createScriptProcessor(bufferSize, 1, 1);
            initializeNoiseSuppressionModule();
            processorNode.onaudioprocess = (e) => {
                var input = e.inputBuffer.getChannelData(0);
                var output = e.outputBuffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    inputBuffer.push(input[i]);
                }
                while (inputBuffer.length >= 480) {
                    for (let i = 0; i < 480; i++) {
                        frameBuffer[i] = inputBuffer.shift();
                    }
                    // Process Frame
                    removeNoise(frameBuffer);
                    for (let i = 0; i < 480; i++) {
                        outputBuffer.push(frameBuffer[i]);
                    }
                }
                // Not enough data, exit early, etherwise the AnalyserNode returns NaNs.
                if (outputBuffer.length < bufferSize) {
                    return;
                }
                // Flush output buffer.
                for (let i = 0; i < bufferSize; i++) {
                    output[i] = outputBuffer.shift();
                }
            };

            return processorNode;
        }
        const setupAddonHandleAudioWorklet = async (ctx) => {
            //if (isWorkletRegistered) return;
            try {
                // import handle-addon-data.js is not working in package, so use blob to load it
                const workletCode = `
                    function concatenateByteArrays(array1, array2) {
                        const result = new Float32Array(array1.length + array2.length);
                        result.set(array1, 0);
                        result.set(array2, array1.length);
                        return result;
                    }


                    class HandleAddonData extends AudioWorkletProcessor {
                        constructor() {
                            super();
                            this.audioBuffer = new Float32Array(0); // 用于缓存外部音频数据
                            this.lastReceivedTime = 0;
                            this.originData = new Float32Array(0);
                            this.offset = 0;
                            this.port.onmessage = (event) => {// 拼接外部数据
                                //console.log('received data, '+(Date.now()-this.lastReceivedTime))
                                this.port.postMessage(Date.now()-this.lastReceivedTime)
                                this.lastReceivedTime = Date.now()
                                this.audioBuffer = concatenateByteArrays(this.audioBuffer, event.data)
                                this.originData = event.data
                            };

                        }

                        process(inputs, outputs, parameters) {
                            const output = outputs[0]
                            output.forEach((channel) => {
                                if (!this.audioBuffer.length) {
                                    channel.fill(0); // 如果dataBuffer为空,输出静默
                                } else {
                                    const blockData = this.audioBuffer.subarray(0, 128)
                                    channel.set(blockData)
                                    this.audioBuffer = this.audioBuffer.subarray(128)
                                }
                            });
                            this.port.postMessage({type: 'bufferLength', data: this.audioBuffer.length})
                            return true;
                        }
                    }

                    registerProcessor('handle-addon-data', HandleAddonData);
                `
                const blob = new Blob([workletCode], { type: 'application/javascript' });
                const workletUrl = URL.createObjectURL(blob);
                await ctx.audioWorklet.addModule(workletUrl);
                //await ctx.audioWorklet.addModule('../utils/handle-addon-data.js')
                setIsWorkletRegistered(true);
                nodesRef.current.handleAddonDataNode = new AudioWorkletNode(ctx_main, 'handle-addon-data')
                nodesRef.current.handleAddonDataNode.connect(nodesRef.current.addonGainNode)
                nodesRef.current.handleAddonDataNode.port.onmessage = (event) => {
                    if (event.data.type === 'bufferLength') {
                        if (bufferLengthRef.current) {
                            bufferLengthRef.current.innerHTML = 'buffer length in audioworklet: ' + event.data.data;
                        }
                    } else {
                        if (processorIntervalRef.current) {
                            processorIntervalRef.current.innerHTML = 'audio data to processor interval: ' + event.data + 'ms';
                        }
                    }
                }
            } catch (error) {
                console.error("Failed to set up AudioWorklet:", error);
            }
        }
        const ctx_main = ctx_mainRef.current
        if (localStream && ctx_main) {
            nodesRef.current.sourceNode = ctx_main.createMediaStreamSource(localStream)
            nodesRef.current.gainNode = ctx_main.createGain()
            nodesRef.current.processorNode = initNoiseReduceProcessorNode(ctx_main)
            nodesRef.current.addonGainNode = ctx_main.createGain()
            nodesRef.current.addonDestinationNode = ctx_main.createMediaStreamDestination()
            nodesRef.current.mergerNode = ctx_main.createChannelMerger()
            nodesRef.current.analyser = ctx_main.createAnalyser()
            nodesRef.current.destinationNode = ctx_main.createMediaStreamDestination()
            setupAddonHandleAudioWorklet(ctx_main)
            nodesRef.current.sourceNode.connect(nodesRef.current.gainNode)
            nodesRef.current.gainNode.connect(nodesRef.current.processorNode)
            nodesRef.current.processorNode.connect(nodesRef.current.mergerNode)
            nodesRef.current.addonGainNode.connect(nodesRef.current.mergerNode)
            nodesRef.current.addonGainNode.connect(nodesRef.current.addonDestinationNode)
            nodesRef.current.mergerNode.connect(nodesRef.current.destinationNode)
            nodesRef.current.mergerNode.connect(nodesRef.current.analyser)

            const finalStream = nodesRef.current.destinationNode.stream
            setFinalStream(finalStream)

            const addonStream = nodesRef.current.addonDestinationNode.stream
            setAddonStream(addonStream)

            nodesRef.current.analyser.fftSize = 256;
            const bufferLength = nodesRef.current.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            const checkAudioLevel = () => {
                nodesRef.current.analyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((acc, value) => acc + value, 0) / bufferLength;
                setSelfAudioActive(average > 10)
                selfAnimationFramesRef.current = requestAnimationFrame(checkAudioLevel)
            }
            checkAudioLevel()
        }
    }, [localStream])

    const toggleNoiseReduction = (isEnabled) => {
        if (!nodesRef.current.sourceNode || !nodesRef.current.gainNode ||
            !nodesRef.current.processorNode || !nodesRef.current.mergerNode) {
            console.error("Audio nodes are not initialized");
            return;
        }

        // 断开所有相关连接
        nodesRef.current.gainNode.disconnect();
        nodesRef.current.processorNode.disconnect();

        if (isEnabled) {
            // 启用降噪
            nodesRef.current.gainNode.connect(nodesRef.current.processorNode);
            nodesRef.current.processorNode.connect(nodesRef.current.mergerNode);
        } else {
            // 禁用降噪，直接连接
            nodesRef.current.gainNode.connect(nodesRef.current.mergerNode);
        }
    };

    //audio capture process id check loop
    useEffect(() => {
        const audioCaptureInterval = setInterval(async () => {
            const electronPid = await window.winAudioCapture.getElectronProcessId()
            const processesList = window.winAudioCapture.getAudioProcessInfo()
            const newProcessList = []
            for (let item of processesList) {
                if (!electronPid.includes(item.processId) &&
                    item.processId !== 0 &&
                    item.processName !== 'audiodg.exe'
                ) {
                    newProcessList.push(item)
                }
            }
            setAudioProcesses(newProcessList)
        }, 2000);
        // initialize before capture
        console.log(window.winAudioCapture.initializeCapture())

        return () => {
            clearInterval(audioCaptureInterval);
        };
    }, [])

    //capture module callback
    const captureStatus = useRef(false)
    useEffect(() => {
        let captureControl = null
        if (captureProcess !== null) {
            console.log(window.winAudioCapture.initializeCLoopbackCapture(captureProcess))

            const res = window.winAudioCapture.getActivateStatus()
            if (res.interfaceActivateResult === 0) {
                try {
                    captureControl = window.winAudioCapture.capture_async(intervalMs, (err, result) => {
                        if (err) {
                            console.error("Capture error:", err);
                            return;
                        }
                        //console.log(result)
                        captureStatus.current = true
                        if (result !== null && nodesRef.current.handleAddonDataNode !== null) {
                            ctx_mainRef.current.decodeAudioData(result.wavData.buffer)
                                .then((audioBuffer) => {
                                    const wavChannelData = audioBuffer.getChannelData(0)
                                    nodesRef.current.handleAddonDataNode.port.postMessage(wavChannelData)
                                })
                                .catch((err) => {
                                    console.log("decode error:", err);
                                })
                        }
                    })
                }
                catch (error) {
                    console.error("Capture error:", error);
                }
            } else {
                console.log('initialize capture failed')
            }
        }

        return () => {
            if (captureStatus.current === true && captureControl !== null) {
                captureControl.stop()
                captureStatus.current = false
            }
        }
    }, [captureProcess, intervalMs])


    const value = {
        ctx_main: ctx_mainRef.current,
        finalStream,
        addonStream,
        inputDevices,
        outputDevices,
        selectedInput,
        selectedOutput,
        setSelectedInput,
        setSelectedOutput,
        inputVolume,
        outputVolume,
        setInputVolume,
        setOutputVolume,
        nodesRef,
        selfAudioActive,
        audioProcesses,
        captureProcess,
        setCaptureProcess,
        bufferLengthRef,
        processorIntervalRef,
        toggleNoiseReduction,
        intervalMs,
        setIntervalMs
    }
    return <AudioUtilsContext.Provider value={value}>
        {children}
    </AudioUtilsContext.Provider>
}

export const useAudio = () => {
    const audio = useContext(AudioUtilsContext);
    if (!audio) {
        throw new Error('useAudio must be used within a AudioProvider');
    }
    return audio;
};
