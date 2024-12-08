import { useState, useRef, useLayoutEffect } from 'react'
import { Settings, Info } from 'lucide-react'
import { useAudio } from '@/contexts/AudioContext'
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import SwitchButton from './switch_Admin12121/switch'
import AudioVisualizer from '@/utils/AudioLevelVisualizer'


const SettingPopover = ({
    isSettingPopoverOpen,
    setIsSettingPopoverOpen
}) => {
    const {
        finalStream,
        inputDevices,
        outputDevices,
        selectedInput,
        setSelectedInput,
        selectedOutput,
        setSelectedOutput,
        toggleNoiseReduction
    } = useAudio()
    const [testVolume, setTestVolume] = useState(false);
    const [isNoiseReductionEnabled, setIsNoiseReductionEnabled] = useState(true);
    const localAudioCanvasRef = useRef(null);
    const localAudioRef = useRef(null);

    //final stream connect to audio element
    useLayoutEffect(() => {
        if (isSettingPopoverOpen) {
            const timeoutId = setTimeout(() => {
                //console.log(finalStream, localAudioRef.current, localAudioCanvasRef.current);
                if (finalStream && localAudioRef.current && !localAudioRef.current.srcObject) {
                    localAudioRef.current.srcObject = finalStream;
                }
                if (finalStream && localAudioCanvasRef.current) {
                    const visualizer = new AudioVisualizer(finalStream, localAudioCanvasRef.current, 128);
                    visualizer.start();
                }
            }, 0);

            return () => clearTimeout(timeoutId);
        }
    }, [isSettingPopoverOpen, finalStream])


    return (
        <Popover
            open={isSettingPopoverOpen}
            onOpenChange={(res) => {
                setIsSettingPopoverOpen(res)
                setTestVolume(false)
            }}
        >
            <PopoverTrigger asChild>
                <Button size="icon" variant="ghost" className={isSettingPopoverOpen ? 'z-50' : null}>
                    <Settings className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="z-50 w-full ml-4">
                <div className='flex flex-col mb-2 gap-2'>
                    <p className='text-md font-bold'>Input & Output Device Settings</p>
                    <p className='text-sm text-muted-foreground'>select or test your input and output device</p>
                </div>
                <div className='flex flex-col gap-4 w-[900px]'>
                    <div className='grid grid-cols-[1fr_1fr] gap-4'>
                        {/*device change*/}
                        <div className='flex flex-col gap-4 mt-6'>
                            <div className='flex flex-col gap-2'>
                                <p>Input Device:</p>
                                <Select
                                    value={selectedInput}
                                    onValueChange={deviceId => setSelectedInput(deviceId)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select audio input device" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {inputDevices.map(item =>
                                            <SelectItem value={item.value} key={item.value}>
                                                {item.label}
                                            </SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className='flex flex-col gap-2'>
                                <p>Output Device:</p>
                                <Select
                                    value={selectedOutput}
                                    onValueChange={deviceId => setSelectedOutput(deviceId)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select audio Output device" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {outputDevices.map(item =>
                                            <SelectItem value={item.value} key={item.value}>
                                                {item.label}
                                            </SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button
                                className='w-full mt-2'
                                variant="secondary"
                                onClick={() => { setTestVolume(!testVolume) }}
                            >
                                {!testVolume ? 'test your input & output' : 'stop testing'}
                            </Button>
                        </div>
                        {/*test volume*/}
                        <div className='flex flex-col justify-start w-full mt-7'>
                            <audio autoPlay muted={!testVolume} ref={localAudioRef}></audio>
                            <canvas ref={localAudioCanvasRef} className='w-full bg-neutral-900 rounded-md' style={{ /*aspectRatio: '3/1'*/ }}></canvas>

                            {/*
                            {nodesRef.current.destinationNode !== null ? <AudioLevelMeter audioStream={nodesRef.current.destinationNode.stream} /> : null}
                            */}
                        </div>
                    </div>
                    {/*noise reduction*/}
                    <div className='flex flex-col justify-end items-start w-full'>
                        <div className='flex flex-row gap-8 items-center justify-between w-1/2'>
                            <div className='flex flex-col'>
                                <p>RNN Noise Reduction</p>
                                <p className='text-muted-foreground text-xs'>noise reduction is enabled by default</p>
                            </div>

                            <SwitchButton
                                scale={0.6}
                                checked={isNoiseReductionEnabled}
                                onChange={(res) => {
                                    console.log('noise reduction:', res);
                                    setIsNoiseReductionEnabled(res)
                                    toggleNoiseReduction(res)
                                }}
                            />

                        </div>
                        <p className='text-muted-foreground text-xs'>
                            <Info className='inline-block mr-1 h-4 w-4' />this RNN noise reduction module is from <a href='https://jmvalin.ca/demo/rnnoise/' target='_blank'>https://jmvalin.ca/demo/rnnoise/</a>
                        </p>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

export default SettingPopover