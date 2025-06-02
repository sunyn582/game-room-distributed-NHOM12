const { InfluxDB } = require("@influxdata/influxdb-client")
const { OrgsAPI, BucketsAPI } = require("@influxdata/influxdb-client-apis")

async function initInfluxDB() {
  const url = "http://localhost:8086"
  const token = "zIGlnIr44LpdJnobJ68V8AHdzsWfaIShovlLY9m5ZDX3j_8SisNNq7BF-btVVgFuHMtlXEkswG0xoO0UoXcw4w=="

  const influxDB = new InfluxDB({ url, token })

  try {
    console.log("🚀 Khởi tạo InfluxDB cho Nhóm 12...")

    // Kiểm tra kết nối
    const orgsAPI = new OrgsAPI(influxDB)
    const organizations = await orgsAPI.getOrgs()

    let nhom12Org = organizations.orgs?.find((org) => org.name === "nhom_12")

    if (!nhom12Org) {
      console.log("📝 Tạo organization nhom_12...")
      nhom12Org = await orgsAPI.postOrgs({
        body: {
          name: "nhom_12",
          description: "Organization for Nhom 12 Game Room Project",
        },
      })
    }

    // Kiểm tra bucket wed-game
    const bucketsAPI = new BucketsAPI(influxDB)
    const buckets = await bucketsAPI.getBuckets({ org: "nhom_12" })

    let wedGameBucket = buckets.buckets?.find((bucket) => bucket.name === "buckets1")

    if (!wedGameBucket) {
      console.log("📦 Tạo bucket wed-game...")
      wedGameBucket = await bucketsAPI.postBuckets({
        body: {
          name: "wed-game",
          orgID: nhom12Org.id,
          description: "Bucket for web game monitoring data",
          retentionRules: [
            {
              type: "expire",
              everySeconds: 2592000, // 30 days
            },
          ],
        },
      })
    }

    console.log("✅ InfluxDB đã được khởi tạo thành công cho Nhóm 12!")
    console.log(`📊 Organization: nhom_12 (${nhom12Org.id})`)
    console.log(`📦 Bucket: wed-game (${wedGameBucket.id})`)
    console.log(`🔑 Token: ${token.substring(0, 20)}...`)
  } catch (error) {
    console.error("❌ Lỗi khởi tạo InfluxDB:", error)
  }
}

// Chạy script nếu được gọi trực tiếp
if (require.main === module) {
  initInfluxDB()
}

module.exports = { initInfluxDB }
