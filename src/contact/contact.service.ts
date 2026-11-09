import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact } from '../entities/contact.entity';

@Injectable()
export class ContactService {
  constructor(
    @InjectRepository(Contact)
    private readonly contacts: Repository<Contact>,
  ) {}

  create(data: {
    firstName: string;
    lastName: string;
    email: string;
    subject: string;
    message: string;
  }): Promise<Contact> {
    return this.contacts.save(this.contacts.create(data));
  }
}
