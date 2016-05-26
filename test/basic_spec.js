import chai from 'chai';
let expect = chai.expect;

describe('Basic test', function () {
  it('should add 2 + 2', done => {
    expect(2 + 2).to.equal(4);
    done();
  })
});
