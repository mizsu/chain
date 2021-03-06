/* eslint-env mocha */

const chain = require('../dist/index.js')
const uuid = require('uuid')
const assert = require('assert')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')

chai.use(chaiAsPromised)
const expect = chai.expect

const client = new chain.Client()
const xAccountAlias = `x-${uuid.v4()}`
const yAccountAlias = `y-${uuid.v4()}`

let mockHsmKey

describe('Accounts test', () => {

  describe('Promise style', () => {

    before('set up API objects', () => {

      // Key and account creation
      return client.mockHsm.keys.create()
        .then(key => { mockHsmKey = key })
        .then(() => {
          return client.accounts.create({alias: xAccountAlias, rootXpubs: [mockHsmKey.xpub], quorum: 1, tags: {x: 0}})
        })
        .then(() => {
          return client.accounts.create({alias: yAccountAlias, rootXpubs: [mockHsmKey.xpub], quorum: 1, tags: {y: 0}})
        })
    })

    describe('Single account creation', () => {

      it('account creation successful', () => {
        return client.accounts.create({alias: `alice-${uuid.v4()}`, rootXpubs: [mockHsmKey.xpub], quorum: 1})
      })

      it('account creation rejected due to missing key fields', () => {
        return expect(client.accounts.create({alias: 'david'})).to.be.rejectedWith('CH202')
      })
    })

    describe('Batch account creation', () => {
      let batchResponse = {}

      before(() => client.accounts.createBatch([
          {alias: `carol-${uuid.v4()}`, rootXpubs: [mockHsmKey.xpub], quorum: 1}, // success
          {alias: 'david'}, // failure
          {alias: `eve-${uuid.v4()}`, rootXpubs: [mockHsmKey.xpub], quorum: 1}, // success
        ])
        .then(resp => {batchResponse = resp})
      )

      it('returns two successes', () => assert.equal(batchResponse.successes[1], null))
      it('returns one error', () => assert.deepEqual([batchResponse.errors[0], batchResponse.errors[2]], [null, null]))
    })

    describe('Single account tags update', () => {

      it('successfully updates account tags', () => {
        return client.accounts.updateTags({
          alias: xAccountAlias,
          tags: {x: 1},
        })
        .then(() => {
          return client.accounts.query({
            filter: `alias='${xAccountAlias}'`
          })
        })
        .then(page => {
          assert.deepEqual(page.items[0].tags, {x: 1})
        })
      })

      it('fails to update account tags', () => {
        return expect(
          client.accounts.updateTags({
            // ID/Alias intentionally omitted
            tags: {x: 1},
          })
        ).to.be.rejectedWith('CH051')
      })
    })

    describe('Batch account tags update', () => {

      it('successfully updates accounts tags', () => {
        return client.accounts.updateTagsBatch([{
          alias: xAccountAlias,
          tags: {x: 2},
        }, {
          alias: yAccountAlias,
          tags: {y: 2},
        }])
        .then(() => {
          return client.accounts.query({
            filter: `alias='${xAccountAlias}' OR alias='${yAccountAlias}'`
          })
        })
        .then(page => {
          assert.deepEqual(page.items.find(i => i.alias.match(/^x-/)).tags, {x: 2})
          assert.deepEqual(page.items.find(i => i.alias.match(/^y-/)).tags, {y: 2})
        })
      })

      it('fails to update accounts tags with missing id', () => {
        return client.accounts.updateTagsBatch([{
          alias: xAccountAlias,
          tags: {x: 3},
        }, {
          // ID/Alias intentionally omitted
          tags: {y: 3}
        }])
        .then(batch => {
          assert(batch.successes[0])
          assert(!batch.successes[1])
          assert(!batch.errors[0])
          assert(batch.errors[1])
        })
      })
    })
  })

  // These just test that the callback is engaged correctly. Behavior is
  // tested in the promises test.
  describe('Callback style', () => {

    it('Single account creation', (done) => {
      client.accounts.create(
        {}, // intentionally blank
        () => done() // intentionally ignore errors
      )
    })

    it('Batch account creation', (done) => {
      client.accounts.createBatch(
        [{}, {}], // intentionally blank
        () => done() // intentionally ignore errors
      )
    })

    it('Single account tags update', (done) => {
      client.accounts.updateTags(
        {}, // intentionally blank
        () => done() // intentionally ignore errors
      )
    })

    it('Batch account tags update', (done) => {
      client.accounts.updateTagsBatch(
        [{}, {}], // intentionally blank
        () => done() // intentionally ignore errors
      )
    })
  })
})
