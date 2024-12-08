// contexts
import { useState, useRef } from 'react'
import { useTailscale } from './contexts/TailscaleContext';
import { useRTC } from './contexts/HttpRtcContext';

// shadcn components
import { Button } from "@/components/ui/button"
import { ThemeProvider } from "@/components/theme-provider"
import { BackgroundBeams } from '@/components/ui/background-beams';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Separator } from "@/components/ui/separator"
import { Toaster } from "@/components/ui/toaster"

// components
import TitleBar from './components/TitleBar'
import NetworkPopover from './components/NetworkPopover/NetworkPopover'
import UserPanel from './components/UserPanel/UserPanel'
import ChannelList from './components/ChannelList/ChannelList'
import RightSideBarCards from './components/RightSideBarCards'
import MidPanel from './components/MidPanel/MidPanel'


function MainLayout() {
    const rightSideBarRef = useRef(null);
    const leftSideBarRef = useRef(null)

    const toggleCollapse = (location, action) => {
        if (location === 'right' && rightSideBarRef.current) {
            const isCollapsed = rightSideBarRef.current.isCollapsed();
            if (action === 'expand' && isCollapsed) {
                rightSideBarRef.current.expand();
            } else if (action === 'collapse' && !isCollapsed) {
                rightSideBarRef.current.collapse();
            }
        } else if (location === 'left' && leftSideBarRef.current) {
            const isCollapsed = leftSideBarRef.current.isCollapsed();
            if (action === 'expand' && isCollapsed) {
                leftSideBarRef.current.expand();
            } else if (action === 'collapse' && !isCollapsed) {
                leftSideBarRef.current.collapse();
            }
        }
    }

    const [isNetworkPopoverOpen, setIsNetworkPopoverOpen] = useState(false)
    const [isSettingPopoverOpen, setIsSettingPopoverOpen] = useState(false)
    const [isChannelPopoverOpen, setIsChannelPopoverOpen] = useState(false)
    const [isAudioCapturePopoverOpen, setIsAudioCapturePopoverOpen] = useState(false)
    const [isUserPopoverOpen, setIsUserPopoverOpen] = useState(false);



    return (
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <div className="flex flex-col h-screen w-screen">
                <TitleBar />
                <BackgroundBeams className='pointer-events-none' />

                <div className="flex-grow h-[calc(100vh-32px)]">
                    {/* Overlay */}
                    {(isNetworkPopoverOpen || isSettingPopoverOpen || isChannelPopoverOpen || isAudioCapturePopoverOpen || isUserPopoverOpen) && (
                        <div
                            className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm z-40"
                            onClick={() => {
                                setIsNetworkPopoverOpen(false)
                                setIsSettingPopoverOpen(false)
                                setIsChannelPopoverOpen(false)
                                setIsAudioCapturePopoverOpen(false)
                                setIsUserPopoverOpen(false)
                            }}
                        />
                    )}

                    <ResizablePanelGroup direction="horizontal">
                        {/* Left Sidebar - Channels and Controls */}
                        <ResizablePanel
                            defaultSize={20}
                            collapsible={true}
                            ref={leftSideBarRef}
                        >
                            <div className="flex flex-col h-full justify-start">
                                <NetworkPopover
                                    isNetworkPopoverOpen={isNetworkPopoverOpen}
                                    setIsNetworkPopoverOpen={setIsNetworkPopoverOpen}
                                />

                                <Separator className="w-full" />

                                <ChannelList toggleCollapse={toggleCollapse} />

                                <div className="pt-0 mt-auto bg-[#2d2d2d]">
                                    <UserPanel
                                        isSettingPopoverOpen={isSettingPopoverOpen}
                                        setIsSettingPopoverOpen={setIsSettingPopoverOpen}
                                        isAudioCapturePopoverOpen={isAudioCapturePopoverOpen}
                                        setIsAudioCapturePopoverOpen={setIsAudioCapturePopoverOpen}
                                        toggleCollapse={toggleCollapse}
                                    />
                                </div>
                            </div>
                        </ResizablePanel>

                        <ResizableHandle className="w-[2px]" withHandle={true} showGripIcon={false} />

                        {/* Main Content Area */}
                        <ResizablePanel className='z-10'>
                            <MidPanel toggleCollapse={toggleCollapse}/>
                        </ResizablePanel>

                        <ResizableHandle className="w-[2px]" withHandle={true} showGripIcon={false} />

                        {/* Right Sidebar - System Info */}
                        <ResizablePanel
                            defaultSize={25}
                            collapsible={true}
                            ref={rightSideBarRef}
                        >
                            <RightSideBarCards />
                        </ResizablePanel>


                    </ResizablePanelGroup>
                </div>
            </div>
            <Toaster />
        </ThemeProvider>
    )
}

export default MainLayout