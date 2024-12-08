import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from '@/components/ui/button'
import { Send } from 'lucide-react'

const ChatInputBox = ({  }) => {
    const [sendTextInput, setSendTextInput] = useState('')

    const sendText = () => {
        console.log(sendTextInput)
    }

    return (
        <div className="p-4 px-8 pt-0 mt-auto">
            <div className="flex flex-row gap-4">
                <Input
                    className="flex-grow bg-[#2d2d2d] rounded-full"
                    placeholder="Type message here..."
                    value={sendTextInput}
                    onChange={(e) => { setSendTextInput(e.target.value) }}
                    clearButton={true}
                    onClear={() => { setSendTextInput('') }}
                />
                <Button className="rounded-full" onClick={() => sendText()}>
                    <Send className="" />
                </Button>
            </div>

        </div>
    )
}

export default ChatInputBox;
