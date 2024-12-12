import { useEffect, useState } from "react"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useDB } from "@/contexts/DBContext"
import AvatarSelector from "./AvatarSelector"

export default function UserProfile() {
    const { isInitialized, setSelfConfig, getUserConfig, updateUserConfig, configVersion } = useDB()
    const [currentName, setCurrentName] = useState("default_User_Name")
    const [currentAvatar, setCurrentAvatar] = useState("https://github.com/shadcn.png")
    const [DBUserConfig, setDBUserConfig] = useState({})
    useEffect(() => {
        if (!isInitialized) return

        getUserConfig().then(config => {
            console.log(config)
            setDBUserConfig(config)
            setCurrentName(config.user_name)
            setCurrentAvatar(config.user_avatar)
        })
    }, [isInitialized, configVersion])

    const handleSave = () => {
        updateUserConfig({
            user_name: currentName,
            user_avatar: currentAvatar,
        })
        setSelfConfig(prev => ({
            ...prev,
            user_name: currentName,
            user_avatar: currentAvatar,
        }))
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <div className="flex items-center gap-4 cursor-pointer hover:bg-secondary/60 rounded-md p-2">
                    <Avatar className="flex-shrink-0">
                        <AvatarImage src={DBUserConfig.user_avatar} />
                        <AvatarFallback>CN</AvatarFallback>
                    </Avatar>
                    <div className="flex w-full">
                        <span className="text-sm text-left line-clamp-2 break-all">
                            {DBUserConfig.user_name}
                        </span>
                    </div>
                </div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]" showCloseIcon={false}>
                <DialogHeader>
                    <DialogTitle>Edit profile</DialogTitle>
                    <DialogDescription>
                        Make changes to your profile here
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-[auto,1fr] items-center gap-4">
                        {/* 
                        <Label>Set a State</Label>
                        <LottieEmoji
                            currentState={currentState}
                            setCurrentState={setCurrentState}
                        /> */}

                        <AvatarSelector
                            currentAvatar={currentAvatar}
                            setCurrentAvatar={setCurrentAvatar}
                        />

                        <Label htmlFor="username" className="text-right">
                            Username
                        </Label>
                        <Input
                            id="username"
                            defaultValue={currentName}
                            onChange={(e) => {
                                setCurrentName(e.target.value)
                            }}
                        />
                    </div>
                </div>
                <DialogFooter className="sm:justify-between mt-10">
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">
                            Close
                        </Button>
                    </DialogClose>
                    <DialogClose asChild>
                        <Button
                            type="submit"
                            onClick={handleSave}
                        >
                            Save changes
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}