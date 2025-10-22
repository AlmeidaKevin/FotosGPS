import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource, Photo as CameraPhoto } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Platform } from '@ionic/angular';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

@Injectable({
  providedIn: 'root'
})
export class PhotoService {

  public photos: UserPhoto[] = [];
  private readonly PHOTO_STORAGE = 'photos';
  private readonly LOCATIONS_FILE = 'locations.txt';

  constructor(private platform: Platform) {}

  //Captura la foto, obtiene ubicación y guarda
  public async addNewToGallery() {
    const capturedPhoto = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 100
    });

    let location: PhotoLocation | undefined;
    try {
      const pos = await Geolocation.getCurrentPosition();
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      location = { lat, lon }; // 🔹 mapsLink ya no se guarda aquí
    } catch (e) {
      console.warn('No se pudo obtener la localización', e);
    }

    const savedImageFile = await this.savePicture(capturedPhoto, location);

    // 🔹 Evita duplicar fotos
    this.photos.unshift(savedImageFile);

    await Preferences.set({
      key: this.PHOTO_STORAGE,
      value: JSON.stringify(this.photos)
    });

    await this.appendLocationToFile(savedImageFile);
  }

  // Guarda la foto en el sistema de archivos
  private async savePicture(cameraPhoto: CameraPhoto, location?: PhotoLocation): Promise<UserPhoto> {
    const base64Data = await this.readAsBase64(cameraPhoto);
    const fileName = `${Date.now()}.jpeg`;

    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Data
    });

    return this.platform.is('hybrid')
      ? {
          filepath: savedFile.uri,
          webviewPath: Capacitor.convertFileSrc(savedFile.uri),
          fileName,
          location
        }
      : {
          filepath: fileName,
          webviewPath: cameraPhoto.webPath,
          fileName,
          location
        };
  }

  // Lee la foto como base64
  private async readAsBase64(cameraPhoto: CameraPhoto): Promise<string> {
    if (this.platform.is('hybrid')) {
      const file = await Filesystem.readFile({
        path: cameraPhoto.path!
      });
      return file.data as string;
    } else {
      const response = await fetch(cameraPhoto.webPath!);
      const blob = await response.blob();
      return (await this.convertBlobToBase64(blob)) as string;
    }
  }

  private convertBlobToBase64 = (blob: Blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });

  //Carga las fotos guardadas
  public async loadSaved() {
    const { value } = await Preferences.get({ key: this.PHOTO_STORAGE });
    this.photos = (value ? JSON.parse(value) : []) as UserPhoto[];

    if (!this.platform.is('hybrid')) {
      for (const photo of this.photos) {
        const readFile = await Filesystem.readFile({
          path: photo.filepath,
          directory: Directory.Data
        });
        photo.webviewPath = `data:image/jpeg;base64,${readFile.data}`;
      }
    }
  }

  //Guarda la ubicación en el archivo de texto
  private async appendLocationToFile(photo: UserPhoto): Promise<void> {
    if (!photo.location) return;

    const { lat, lon } = photo.location;
    const mapsLink = `https://www.google.com/maps?q=${lat},${lon}`;
    const line = `${photo.fileName ?? photo.filepath} | ${lat},${lon} | ${mapsLink}\n`;

    try {
      const existing = await Filesystem.readFile({
        path: this.LOCATIONS_FILE,
        directory: Directory.Data
      });
      const newData = (existing.data ?? '') + line;

      await Filesystem.writeFile({
        path: this.LOCATIONS_FILE,
        data: newData,
        directory: Directory.Data,
        recursive: true
      });
    } catch {
      await Filesystem.writeFile({
        path: this.LOCATIONS_FILE,
        data: line,
        directory: Directory.Data,
        recursive: true
      });
    }
  }

  // Devuelve el contenido del archivo de ubicaciones
  public async getLocationsFileContent(): Promise<string> {
    try {
      const file = await Filesystem.readFile({
        path: this.LOCATIONS_FILE,
        directory: Directory.Data
      });
      return file.data as string;
    } catch {
      return 'No hay ubicaciones registradas.';
    }
  }
}

// Interfaces de datos
export interface UserPhoto {
  filepath: string;
  webviewPath?: string;
  fileName?: string;
  location?: PhotoLocation;
}

export interface PhotoLocation {
  lat: number;
  lon: number;
}
