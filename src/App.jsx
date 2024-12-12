import './App.css'
import MainLayout from './MainLayout'
import { TailscaleProvider } from './contexts/TailscaleContext'
import { RTCProvider } from './contexts/HttpRtcContext';
import { AudioProvider } from './contexts/AudioContext'
import { DBProvider } from './contexts/DBContext'
import { VoiceStreamProvider } from './contexts/VoiceStreamContext'

function App() {
    return (
        <TailscaleProvider>
            <DBProvider>
                <RTCProvider>
                    <AudioProvider>
                        <VoiceStreamProvider>
                            <MainLayout />
                        </VoiceStreamProvider>
                    </AudioProvider>
                </RTCProvider>
            </DBProvider >
        </TailscaleProvider>
    )
}

export default App
