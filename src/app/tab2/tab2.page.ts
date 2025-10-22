import { Component, OnInit } from '@angular/core';
import { PhotoService } from '../services/photo';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false,

})
export class Tab2Page implements OnInit {

  constructor(public photoService: PhotoService) {}

  async ngOnInit() {
    await this.photoService.loadSaved();
  }

  async addPhotoToGallery() {
    await this.photoService.addNewToGallery();
  }

  async showLocations() {
    const content = await this.photoService.getLocationsFileContent();
    alert(content);
  }
}
