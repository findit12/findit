import { ConflictException, ForbiddenException, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHttpTestApp } from '../common/testing/http-test-app';
import { DiscussionsController } from './discussions.controller';
import { DiscussionsService } from './discussions.service';

// Lab 6: every route of /api/conversations, through real HTTP requests.
describe('DiscussionsController (HTTP)', () => {
  let app: INestApplication;
  const service = {
    start: jest.fn(),
    findMine: jest.fn(),
    countUnread: jest.fn(),
    findOne: jest.fn(),
    updateProof: jest.fn(),
    remove: jest.fn(),
    getMessages: jest.fn(),
    sendMessage: jest.fn(),
    getMessage: jest.fn(),
    updateMessage: jest.fn(),
    removeMessage: jest.fn(),
    markReturned: jest.fn(),
  };
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createHttpTestApp([DiscussionsController], [{ provide: DiscussionsService, useValue: service }]);
  });
  afterAll(() => app.close());
  beforeEach(() => jest.resetAllMocks());

  it('refuses every route without sign-in', async () => {
    expect((await http().get('/api/conversations')).status).toBe(401);
    expect((await http().post('/api/conversations').send({})).status).toBe(401);
    expect((await http().delete('/api/conversations/3')).status).toBe(401);
  });

  it('POST /api/conversations starts a discussion with a proof', async () => {
    service.start.mockResolvedValue({ message: 'Discussion started successfully.', discussionId: 3 });
    const res = await http().post('/api/conversations').set('x-user-id', '2').send({ announcementId: 7, description: ' A scratch ' });
    expect(res.status).toBe(201);
    expect(res.body.discussionId).toBe(3);
    expect(service.start).toHaveBeenCalledWith(2, { announcementId: 7, description: 'A scratch' });
  });

  it('POST /api/conversations refuses a missing proof', async () => {
    const res = await http().post('/api/conversations').set('x-user-id', '2').send({ announcementId: 7, description: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Enter a description to prove ownership.');
    expect(service.start).not.toHaveBeenCalled();
  });

  it('GET /api/conversations lists my discussions and GET unread-count counts the messages', async () => {
    service.findMine.mockResolvedValue({ discussions: [] });
    service.countUnread.mockResolvedValue({ unreadCount: 4 });
    expect((await http().get('/api/conversations').set('x-user-id', '2')).status).toBe(200);
    const res = await http().get('/api/conversations/unread-count').set('x-user-id', '2');
    expect(res.body).toEqual({ unreadCount: 4 });
  });

  it('GET /api/conversations/:id reads one discussion', async () => {
    service.findOne.mockResolvedValue({ discussion: { id: 3 } });
    const res = await http().get('/api/conversations/3').set('x-user-id', '2');
    expect(res.status).toBe(200);
    expect(service.findOne).toHaveBeenCalledWith(3, 2);
  });

  it('GET /api/conversations/:id answers 403 to a third person', async () => {
    service.findOne.mockRejectedValue(new ForbiddenException('You are not a participant in this discussion.'));
    const res = await http().get('/api/conversations/3').set('x-user-id', '8');
    expect(res.status).toBe(403);
  });

  it('PUT /api/conversations/:id corrects the proof', async () => {
    service.updateProof.mockResolvedValue({ discussion: { id: 3, proof: 'New' } });
    const res = await http().put('/api/conversations/3').set('x-user-id', '2').send({ description: 'New' });
    expect(res.status).toBe(200);
    expect(service.updateProof).toHaveBeenCalledWith(3, 2, { description: 'New' });
  });

  it('PUT /api/conversations/:id refuses an empty proof and a closed announcement', async () => {
    const empty = await http().put('/api/conversations/3').set('x-user-id', '2').send({ description: '' });
    expect(empty.status).toBe(400);

    service.updateProof.mockRejectedValue(new ConflictException('This announcement is no longer available.'));
    const closed = await http().put('/api/conversations/3').set('x-user-id', '2').send({ description: 'New' });
    expect(closed.status).toBe(409);
  });

  it('DELETE /api/conversations/:id answers 204 with no body', async () => {
    service.remove.mockResolvedValue(undefined);
    const res = await http().delete('/api/conversations/3').set('x-user-id', '2');
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(service.remove).toHaveBeenCalledWith(3, 2);
  });

  it('GET and POST /api/conversations/:id/messages read and send messages', async () => {
    service.getMessages.mockResolvedValue({ proof: {}, messages: [] });
    service.sendMessage.mockResolvedValue({ message: { id: 9 } });
    expect((await http().get('/api/conversations/3/messages').set('x-user-id', '2')).status).toBe(200);

    const sent = await http().post('/api/conversations/3/messages').set('x-user-id', '2').send({ content: ' Hi ' });
    expect(sent.status).toBe(201);
    expect(service.sendMessage).toHaveBeenCalledWith(3, 2, { content: 'Hi' });
  });

  it('POST /api/conversations/:id/messages refuses an empty message', async () => {
    const res = await http().post('/api/conversations/3/messages').set('x-user-id', '2').send({ content: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Message cannot be empty.');
  });

  it('GET /api/conversations/:id/messages/:messageId reads one message', async () => {
    service.getMessage.mockResolvedValue({ message: { id: 9 } });
    const res = await http().get('/api/conversations/3/messages/9').set('x-user-id', '2');
    expect(res.status).toBe(200);
    expect(service.getMessage).toHaveBeenCalledWith(3, 9, 2);
  });

  it('PUT /api/conversations/:id/messages/:messageId changes a message', async () => {
    service.updateMessage.mockResolvedValue({ message: { id: 9, content: 'Edited' } });
    const res = await http().put('/api/conversations/3/messages/9').set('x-user-id', '2').send({ content: 'Edited' });
    expect(res.status).toBe(200);
    expect(service.updateMessage).toHaveBeenCalledWith(3, 9, 2, { content: 'Edited' });
  });

  it('PUT .../messages/:messageId answers 409 when the message was already read', async () => {
    service.updateMessage.mockRejectedValue(new ConflictException('This message has already been read.'));
    const res = await http().put('/api/conversations/3/messages/9').set('x-user-id', '2').send({ content: 'Edited' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('This message has already been read.');
  });

  it('DELETE /api/conversations/:id/messages/:messageId answers 204', async () => {
    service.removeMessage.mockResolvedValue(undefined);
    const res = await http().delete('/api/conversations/3/messages/9').set('x-user-id', '2');
    expect(res.status).toBe(204);
    expect(service.removeMessage).toHaveBeenCalledWith(3, 9, 2);
  });

  it('POST /api/conversations/:id/return confirms the handover', async () => {
    service.markReturned.mockResolvedValue({ message: 'ok' });
    const res = await http().post('/api/conversations/3/return').set('x-user-id', '2');
    expect(res.status).toBe(200);
  });
});
