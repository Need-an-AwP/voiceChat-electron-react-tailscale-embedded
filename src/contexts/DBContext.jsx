import { createContext, useContext, useEffect, useState } from 'react';
import { useTailscale } from './TailscaleContext';


class IndexedDBService {
    constructor(currentNetwork, configVersion, setConfigVersion, version = 1) {
        this.dbName = "configDB";
        this.currentNetwork = currentNetwork;
        this.version = version;
        this.db = null;
        this.configVersion = configVersion;
        this.setConfigVersion = setConfigVersion;
    }

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            request.onerror = () => reject(request.error);

            // triggered when the database is being created or upgraded
            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains('userConfig')) {
                    const userConfigStore = db.createObjectStore('userConfig', { keyPath: 'id', autoIncrement: true });
                    userConfigStore.createIndex('user_name', 'user_name', { unique: false });
                    userConfigStore.createIndex('user_avatar', 'user_avatar', { unique: false });
                    userConfigStore.createIndex('user_state', 'user_state', { unique: false });

                    userConfigStore.add({
                        user_name: "default_User_Name",
                        user_avatar: "https://github.com/shadcn.png",
                        user_state: "default_User_State",
                    })
                }
                if (!db.objectStoreNames.contains('networks')) {
                    const networksStore = db.createObjectStore('networks', { keyPath: 'id', autoIncrement: true });
                    networksStore.createIndex('network_name', 'network_name', { unique: false });
                    networksStore.createIndex('network_id', 'network_id', { unique: true });
                
                    networksStore.add(this.currentNetwork);
                }
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
        })
    }

    async addNetwork(network) {
        if (!network || typeof network !== 'object') {
            throw new Error('network 参数必须是一个对象');
        }
        if (!network.network_name || typeof network.network_name !== 'string') {
            throw new Error('network.network_name 是必填字段且必须是字符串');
        }
        if (!network.network_id || typeof network.network_id !== 'number') {
            throw new Error('network.network_id 是必填字段且必须是数字');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['networks'], 'readwrite');
            const store = transaction.objectStore('networks');
            const request = store.add(network);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        })
    }

    async getAllNetworks() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['networks'], 'readonly');
            const store = transaction.objectStore('networks');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        })
    }

    async updateNetwork(network) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['networks'], 'readwrite');
            const store = transaction.objectStore('networks');
            const request = store.put(network);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        })
    }

    async deleteNetwork(network_id) {
        if (!network_id || typeof network_id !== 'number') {
            throw new Error('network_id 是必填字段且必须是数字');
        }
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['networks'], 'readwrite');
            const store = transaction.objectStore('networks');
            const request = store.delete(network_id);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        })
    }


    static async deleteDatabase(dbName) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(dbName);

            request.onsuccess = () => {
                console.log(`数据库 ${dbName} 已删除`);
                resolve(true);
            };

            request.onerror = () => {
                console.error(`删除数据库 ${dbName} 失败`);
                reject(request.error);
            };
        });
    }


    async getUserConfig() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['userConfig'], 'readonly');
            const store = transaction.objectStore('userConfig');
            const request = store.getAll();

            request.onsuccess = () => {
                // 因为只有一条记录，直接返回第一条
                resolve(request.result[0]);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // 更新用户配置
    async updateUserConfig(config) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['userConfig'], 'readwrite');
            const store = transaction.objectStore('userConfig');

            // 先获取现有配置的 id
            const getRequest = store.getAll();

            getRequest.onsuccess = () => {
                const currentConfig = getRequest.result[0];
                const updatedConfig = {
                    ...currentConfig,
                    ...config,
                    updatedAt: new Date().toISOString()
                };

                const updateRequest = store.put(updatedConfig);

                updateRequest.onsuccess = () => resolve(updatedConfig);
                updateRequest.onerror = () => reject(updateRequest.error);
            };

            this.setConfigVersion(this.configVersion + 1);
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    // 重置用户配置
    async resetUserConfig() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['userConfig'], 'readwrite');
            const store = transaction.objectStore('userConfig');

            // 先清除所有配置
            const clearRequest = store.clear();

            clearRequest.onsuccess = () => {
                // 添加默认配置
                const defaultConfig = {
                    user_name: "default_User_Name",
                    user_avatar: "https://github.com/shadcn.png",
                    user_state: "default_User_State",
                    createdAt: new Date().toISOString()
                };

                const addRequest = store.add(defaultConfig);

                addRequest.onsuccess = () => resolve(defaultConfig);
                addRequest.onerror = () => reject(addRequest.error);
            };

            clearRequest.onerror = () => reject(clearRequest.error);
        });
    }
}


const DBContext = createContext();

export const DBProvider = ({ children }) => {
    const { status, loginName } = useTailscale();
    const [dbService, setDBService] = useState(null);
    const [currentDBName, setCurrentDBName] = useState('');
    const [isInitialized, setIsInitialized] = useState(false);  // 添加初始化状态
    const [configVersion, setConfigVersion] = useState(0);//it's only a temporary version for useEffect
    const [selfConfig, setSelfConfig] = useState(null);

    useEffect(() => {
        if (!status) return;
        // console.log(status)
        async function checkDB() {
            const currentNetwork = {
                network_name: loginName,
                network_id: status.Self.UserID
            };
            const dbName = loginName;
            if (dbName !== currentDBName) {
                if (dbService?.db) {
                    dbService.db.close();
                }

                setCurrentDBName(dbName);
                const newDBService = new IndexedDBService(currentNetwork, configVersion, setConfigVersion);
                await newDBService.initDB();
                setDBService(newDBService);
                setIsInitialized(true);
                // get user config
                const config = await newDBService.getUserConfig()
                setSelfConfig(config);
            }
        }

        checkDB().catch(console.error);
    }, [status])

    const value = {
        isInitialized,
        configVersion,
        selfConfig,
        setSelfConfig,
        // indexedDB channel methods are deprecated

        // cause status always trigger checkDB method,
        // so the DB will be recreate very fast after the original DB is deleted
        deleteDatabase: async () => {
            if (dbService) {
                dbService.db.close();  // 先关闭连接
                await IndexedDBService.deleteDatabase(currentDBName);
                setDBService(null);
                setIsInitialized(false);
            }
        },
        // user config
        getUserConfig: async () => await dbService?.getUserConfig(),
        updateUserConfig: async (config) => await dbService?.updateUserConfig(config),
        resetUserConfig: async () => await dbService?.resetUserConfig(),
        // network
        getAllNetworks: async () => await dbService?.getAllNetworks(),
        updateNetwork: async (network) => await dbService?.updateNetwork(network),
        deleteNetwork: async (network_id) => await dbService?.deleteNetwork(network_id),

    }

    return (
        <DBContext.Provider value={value}>
            {children}
        </DBContext.Provider>
    );
};

export const useDB = () => {
    const context = useContext(DBContext);
    if (!context) {
        throw new Error('useDB must be used within a DBProvider');
    }
    return context;
};

