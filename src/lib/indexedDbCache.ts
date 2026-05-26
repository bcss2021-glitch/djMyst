/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class IndexedDbCache {
  private dbName = 'DJWebConsoleDB';
  private storeName = 'localTracks';
  private db: IDBDatabase | null = null;

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  async saveTrack(id: string, name: string, size: number, type: string, data: Blob): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const request = store.put({
        id,
        name,
        size,
        type,
        data,
        addedAt: Date.now()
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getTrack(id: string): Promise<Blob | null> {
    try {
      const db = await this.init();
      return new Promise<Blob | null>((resolve, reject) => {
        const transaction = db.transaction(this.storeName, 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(id);

        request.onsuccess = () => {
          if (request.result) {
            resolve(request.result.data);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn("Failed to get track from IndexedDB:", e);
      return null;
    }
  }

  async deleteTrack(id: string): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllTracksMetadata(): Promise<{ id: string; name: string; size: number; type: string; addedAt: number }[]> {
    try {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAll();

        request.onsuccess = () => {
          const results = request.result || [];
          resolve(results.map((r: any) => ({
            id: r.id,
            name: r.name,
            size: r.size,
            type: r.type,
            addedAt: r.addedAt
          })));
        };
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn("Failed to get all metadata from IndexedDB:", e);
      return [];
    }
  }
}

export const indexedDbCache = new IndexedDbCache();
