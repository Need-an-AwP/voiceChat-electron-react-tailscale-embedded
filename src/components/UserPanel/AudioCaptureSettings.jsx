import { useState, useLayoutEffect, useRef } from 'react'
import { Music } from 'lucide-react'
import { useAudio } from '@/contexts/AudioContext'

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import AudioVisualizer from '@/utils/AudioLevelVisualizer'


const AudioCaptureSettings = ({
    isAudioCapturePopoverOpen,
    setIsAudioCapturePopoverOpen
}) => {
    const {
        nodesRef,
        addonStream,
        captureProcess,
        setCaptureProcess,
        audioProcesses,
        processorIntervalRef,
        intervalMs,
        setIntervalMs
    } = useAudio()
    const [addonGain, setAddonGain] = useState(1);
    const [intervalNum, setIntervalNum] = useState(500)

    const addonAudioCanvasRef = useRef(null);

    //addon stream connect to canvas
    useLayoutEffect(() => {
        if (isAudioCapturePopoverOpen) {
            const timeoutId = setTimeout(() => {
                if (addonAudioCanvasRef.current) {
                    const visualizer = new AudioVisualizer(addonStream, addonAudioCanvasRef.current, 64);
                    visualizer.start();
                }
            }, 0);

            return () => clearTimeout(timeoutId);
        }
    }, [isAudioCapturePopoverOpen, addonStream, captureProcess])

    const handleAddonGainChange = (value) => {
        setAddonGain(value);
        if (nodesRef.current.addonGainNode) {
            nodesRef.current.addonGainNode.gain.value = value;
        }
    };

    return (
        <Popover open={isAudioCapturePopoverOpen} onOpenChange={setIsAudioCapturePopoverOpen}>
            <PopoverTrigger asChild>
                <Button size="icon" variant="ghost" className={isAudioCapturePopoverOpen ? 'z-50' : null} disabled={audioProcesses === null}>
                    <Music className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="z-50">
                <div className='flex flex-col gap-2'>
                    <p className='text-md font-bold'>Select an Input Process</p>
                    <p className='text-sm text-muted-foreground mb-2'>process which is playing audio can be captured and added into stream</p>
                    <div className='flex flex-row gap-3'>
                        <Select
                            value={captureProcess}
                            onValueChange={(processId) => { setCaptureProcess(processId) }}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="select a process" />
                            </SelectTrigger>
                            <SelectContent>
                                {audioProcesses.map(item =>
                                    <SelectItem value={item.processId} key={item.processId}>
                                        {item.processName}
                                    </SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                        {captureProcess !== null && (
                            <Button
                                disabled={captureProcess === null}
                                onClick={() => {
                                    setCaptureProcess(null)
                                    setIsAudioCapturePopoverOpen(false)
                                }}
                            >
                                reset
                            </Button>
                        )}
                    </div>

                    {/* <div className='flex flex-row gap-1 items-center text-sm'>
                        <p className='whitespace-nowrap'>request interval</p>
                        <Input
                            className='w-14 h-6'
                            value={intervalNum}
                            onChange={(e) => {
                                setIntervalNum(e.target.value)
                            }}
                        />
                        <p>ms</p>
                        <Button
                            className='w-16 h-6'
                            onClick={() => {
                                const value = parseInt(intervalNum);
                                if (!isNaN(value) && value > 0) {
                                    setIntervalMs(value);
                                    console.log(value);
                                }
                            }}
                        >Confirm</Button>
                    </div> */}
                    {captureProcess !== null && (
                        <div className='flex flex-col gap-2 h-[150px]'>
                            <p className='text-xs text-muted-foreground'>only captured audio shows wave here</p>
                            <div className='w-full h-full flex px-1 justify-between items-center'>
                                <canvas className='w-5/6 h-full bg-neutral-900 rounded-md' ref={addonAudioCanvasRef}></canvas>
                                <Slider
                                    orientation='vertical'
                                    className="w-[20px] h-full bg-secondary rounded-full"
                                    min={0}
                                    max={300}
                                    value={[addonGain * 100]}
                                    onValueChange={(value) => { handleAddonGainChange(value[0] / 100) }}
                                />
                            </div>
                        </div>
                    )}

                    <div ref={processorIntervalRef} className='text-xs text-muted-foreground'></div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

export default AudioCaptureSettings