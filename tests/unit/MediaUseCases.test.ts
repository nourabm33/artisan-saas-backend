import {
  DeleteRequestMediaUseCase,
  MAX_MEDIA_PER_REQUEST,
  UploadRequestMediaUseCase,
} from '@/application/use-cases/media/MediaUseCases';
import { UploadFile } from '@/application/ports/IMediaStorage';
import { Client } from '@/domain/entities/Client';
import { Organization } from '@/domain/entities/Organization';
import { ServiceRequest } from '@/domain/entities/ServiceRequest';
import { Phone } from '@/domain/value-objects/Phone';
import { NotFoundError } from '@/domain/errors/NotFoundError';
import { ValidationError } from '@/domain/errors/ValidationError';
import { createInMemoryRepositories, InMemoryRepositories } from '../helpers/inMemoryRepositories';

const file = (mimeType = 'image/jpeg', originalName = 'tyre.jpg'): UploadFile => ({
  buffer: Buffer.from('data'),
  mimeType,
  originalName,
});

describe('Media use cases', () => {
  let repos: InMemoryRepositories;
  let upload: UploadRequestMediaUseCase;
  let remove: DeleteRequestMediaUseCase;
  let orgId: string;
  let requestId: string;

  beforeEach(async () => {
    repos = createInMemoryRepositories();
    upload = new UploadRequestMediaUseCase(repos, repos.mediaStorage);
    remove = new DeleteRequestMediaUseCase(repos, repos.mediaStorage);

    const org = await repos.organizationRepository.save(
      Organization.create({ name: 'Gommista Demo', tradeType: 'gommista' })
    );
    orgId = org.id;
    const client = await repos.clientRepository.save(
      Client.create({ orgId, phone: new Phone('+393331234567'), name: 'Luca' })
    );
    const request = await repos.requestRepository.save(
      ServiceRequest.create({
        orgId,
        clientId: client.id,
        serviceTemplateId: 'tpl',
        clientData: {},
      })
    );
    requestId = request.id;
  });

  it('stores files and persists media rows with the storage id', async () => {
    const media = await upload.execute(
      orgId,
      requestId,
      [file(), file('application/pdf', 'doc.pdf')],
      'client'
    );

    expect(media).toHaveLength(2);
    expect(media[0]).toMatchObject({ type: 'image', uploadedBy: 'client' });
    expect(media[1].type).toBe('document');
    expect(media[0].url).toMatch(/^https:\/\/cdn\.test\/requests\//);
    expect(repos.mediaStorage.files.size).toBe(2);
    expect(await repos.mediaRepository.countByRequestId(requestId)).toBe(2);
  });

  it('rejects unsupported types, empty uploads and unknown requests', async () => {
    await expect(upload.execute(orgId, requestId, [], 'client')).rejects.toThrow(ValidationError);
    await expect(
      upload.execute(orgId, requestId, [file('application/x-msdownload', 'x.exe')], 'client')
    ).rejects.toThrow(ValidationError);
    await expect(upload.execute('other-org', requestId, [file()], 'artisan')).rejects.toThrow(
      NotFoundError
    );
    expect(repos.mediaStorage.files.size).toBe(0);
  });

  it('enforces the per-request attachment limit', async () => {
    const files = Array.from({ length: MAX_MEDIA_PER_REQUEST }, () => file());
    await upload.execute(orgId, requestId, files, 'client');
    await expect(upload.execute(orgId, requestId, [file()], 'client')).rejects.toThrow(
      ValidationError
    );
  });

  it('removes the stored file when the row cannot be saved', async () => {
    jest.spyOn(repos.mediaRepository, 'save').mockRejectedValueOnce(new Error('db down'));
    await expect(upload.execute(orgId, requestId, [file()], 'client')).rejects.toThrow('db down');
    expect(repos.mediaStorage.files.size).toBe(0);
  });

  it('deletes media within the organization only', async () => {
    const [media] = await upload.execute(orgId, requestId, [file()], 'artisan');
    await expect(remove.execute('other-org', requestId, media.id)).rejects.toThrow(NotFoundError);

    await remove.execute(orgId, requestId, media.id);
    expect(await repos.mediaRepository.findById(media.id)).toBeNull();
    expect(repos.mediaStorage.files.size).toBe(0);
  });
});
