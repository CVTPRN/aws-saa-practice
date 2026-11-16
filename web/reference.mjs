// English expansions are intentional: the SAA-C03 question bank is in English.
export const ABBREVIATIONS = [
  {group:'AWS és vizsga',items:[
    ['AWS','Amazon Web Services'],['AZ','Availability Zone'],['SAA','Solutions Architect – Associate'],
    ['API','Application Programming Interface'],['ARN','Amazon Resource Name'],['CLI','Command Line Interface'],
    ['SDK','Software Development Kit'],['IaC','Infrastructure as Code'],['CI/CD','Continuous Integration / Continuous Delivery'],
    ['HA','High Availability'],['DR','Disaster Recovery'],['RTO','Recovery Time Objective'],['RPO','Recovery Point Objective'],
    ['SLA','Service Level Agreement'],['SLO','Service Level Objective'],['TCO','Total Cost of Ownership'],
    ['CAPEX','Capital Expenditure'],['OPEX','Operating Expenditure'],['PoC','Proof of Concept']
  ]},
  {group:'Hálózat és tartalomkézbesítés',items:[
    ['VPC','Virtual Private Cloud'],['CIDR','Classless Inter-Domain Routing'],['IP','Internet Protocol'],
    ['IPv4','Internet Protocol version 4'],['IPv6','Internet Protocol version 6'],['DNS','Domain Name System'],
    ['DHCP','Dynamic Host Configuration Protocol'],['TCP','Transmission Control Protocol'],['UDP','User Datagram Protocol'],
    ['HTTP','Hypertext Transfer Protocol'],['HTTPS','Hypertext Transfer Protocol Secure'],['TLS','Transport Layer Security'],
    ['SSL','Secure Sockets Layer'],['BGP','Border Gateway Protocol'],['NAT','Network Address Translation'],
    ['IGW','Internet Gateway'],['VGW','Virtual Private Gateway'],['TGW','Transit Gateway'],
    ['VPN','Virtual Private Network'],['DX','AWS Direct Connect'],['DXGW','Direct Connect Gateway'],
    ['NACL','Network Access Control List'],['SG','Security Group'],['ENI','Elastic Network Interface'],
    ['EIP','Elastic IP address'],['IPAM','IP Address Manager'],['MTU','Maximum Transmission Unit'],
    ['TTL','Time to Live'],['CDN','Content Delivery Network'],['VIF','Virtual Interface'],
    ['VPCe','VPC Endpoint'],['ALB','Application Load Balancer'],['NLB','Network Load Balancer'],
    ['GWLB','Gateway Load Balancer'],['ELB','Elastic Load Balancing']
  ]},
  {group:'Compute és konténerek',items:[
    ['EC2','Elastic Compute Cloud'],['AMI','Amazon Machine Image'],['ASG','Auto Scaling group'],
    ['ECS','Elastic Container Service'],['EKS','Elastic Kubernetes Service'],['ECR','Elastic Container Registry'],
    ['CPU','Central Processing Unit'],['vCPU','Virtual Central Processing Unit'],['GPU','Graphics Processing Unit'],
    ['HPC','High Performance Computing'],['OS','Operating System'],['SSH','Secure Shell'],
    ['RDP','Remote Desktop Protocol'],['VM','Virtual Machine'],['HVM','Hardware Virtual Machine'],
    ['LT','Launch Template'],['IMDS','Instance Metadata Service']
  ]},
  {group:'Tárolás és adatvédelem',items:[
    ['S3','Simple Storage Service'],['EBS','Elastic Block Store'],['EFS','Elastic File System'],
    ['SSD','Solid State Drive'],['HDD','Hard Disk Drive'],['IOPS','Input/Output Operations Per Second'],
    ['NFS','Network File System'],['SMB','Server Message Block'],['RAID','Redundant Array of Independent Disks'],
    ['IA','Infrequent Access'],['CRR','Cross-Region Replication'],['SRR','Same-Region Replication'],
    ['SSE','Server-Side Encryption'],['SSE-S3','Server-Side Encryption with Amazon S3 managed keys'],
    ['SSE-KMS','Server-Side Encryption with AWS KMS keys'],['SSE-C','Server-Side Encryption with customer-provided keys'],
    ['CSE','Client-Side Encryption'],['WORM','Write Once Read Many'],['POSIX','Portable Operating System Interface']
  ]},
  {group:'Adatbázis és adatelemzés',items:[
    ['RDS','Relational Database Service'],['DB','Database'],['DBMS','Database Management System'],
    ['RDBMS','Relational Database Management System'],['SQL','Structured Query Language'],
    ['NoSQL','Not Only SQL'],['OLTP','Online Transaction Processing'],['OLAP','Online Analytical Processing'],
    ['DAX','DynamoDB Accelerator'],['RCU','Read Capacity Unit'],['WCU','Write Capacity Unit'],
    ['ACU','Aurora Capacity Unit'],['PITR','Point-in-Time Recovery'],['CDC','Change Data Capture'],
    ['DMS','Database Migration Service'],['SCT','Schema Conversion Tool'],['ETL','Extract, Transform, Load'],
    ['ELT','Extract, Load, Transform'],['BI','Business Intelligence']
  ]},
  {group:'Biztonság és identitás',items:[
    ['IAM','Identity and Access Management'],['STS','Security Token Service'],['KMS','Key Management Service'],
    ['ACM','AWS Certificate Manager'],['MFA','Multi-Factor Authentication'],['SSO','Single Sign-On'],
    ['SCP','Service Control Policy'],['OU','Organizational Unit'],['RAM','Resource Access Manager'],
    ['WAF','Web Application Firewall'],['DDoS','Distributed Denial of Service'],['HSM','Hardware Security Module'],
    ['PKI','Public Key Infrastructure'],['CA','Certificate Authority'],['RBAC','Role-Based Access Control'],
    ['ABAC','Attribute-Based Access Control'],['SAML','Security Assertion Markup Language'],
    ['OIDC','OpenID Connect'],['LDAP','Lightweight Directory Access Protocol'],['PII','Personally Identifiable Information'],
    ['PHI','Protected Health Information'],['FIPS','Federal Information Processing Standards']
  ]},
  {group:'Alkalmazások és üzenetkezelés',items:[
    ['SQS','Simple Queue Service'],['SNS','Simple Notification Service'],['SES','Simple Email Service'],
    ['FIFO','First In, First Out'],['DLQ','Dead-Letter Queue'],['REST','Representational State Transfer'],
    ['JSON','JavaScript Object Notation'],['XML','Extensible Markup Language'],['JWT','JSON Web Token'],
    ['URL','Uniform Resource Locator'],['URI','Uniform Resource Identifier'],['MQTT','Message Queuing Telemetry Transport'],
    ['AMQP','Advanced Message Queuing Protocol'],['SAM','Serverless Application Model'],
    ['KCL','Kinesis Client Library'],['CDK','Cloud Development Kit'],['CFN','CloudFormation']
  ]}
];

const docs={
  az:'https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-availability-zones.html',
  subnet:'https://docs.aws.amazon.com/vpc/latest/userguide/subnet-sizing.html',
  vpc:'https://docs.aws.amazon.com/vpc/latest/userguide/amazon-vpc-limits.html',
  rds:'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Welcome.html',
  s3:'https://docs.aws.amazon.com/AmazonS3/latest/userguide/qfacts.html',
  s3upload:'https://docs.aws.amazon.com/AmazonS3/latest/userguide/upload-objects.html',
  s3durability:'https://docs.aws.amazon.com/AmazonS3/latest/userguide/DataDurability.html',
  lambda:'https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html',
  sqs:'https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/quotas-messages.html',
  gp3:'https://docs.aws.amazon.com/ebs/latest/userguide/general-purpose.html'
};
// Values checked against AWS documentation on 2026-11-16. Defaults are adjustable;
// avoid a fixed worldwide AZ count or a quota without its scope.
export const NUMBER_FACTS = [
  {group:'Régió és hálózat',items:[
    ['Hány AZ van egy AWS-régióban?','Legalább 3; a pontos szám régiónként eltér.',docs.az],
    ['Hány AZ-t foghat át egy subnet?','1 AZ-t.', 'https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html'],
    ['Hány IPv4-cím foglalt AWS által egy subnetben?','5 (az első 4 és az utolsó).',docs.subnet],
    ['Mekkora lehet egy IPv4 subnet CIDR-blokkja?','/16 és /28 között.',docs.subnet],
    ['Hány VPC lehet egy régióban alapkvótával?','5 / fiók / régió; emelhető.',docs.vpc],
    ['Hány subnet lehet egy VPC-ben alapkvótával?','200; emelhető.',docs.vpc],
    ['Hány szabály lehet egy security groupban alapkvótával?','60 bejövő és 60 kimenő; emelhető.',docs.vpc],
    ['Hány security group kapcsolható egy ENI-hez alapkvótával?','5; legfeljebb 16-ra emelhető.',docs.vpc]
  ]},
  {group:'Adatbázis és tárolás',items:[
    ['Hány AZ-t használ egy RDS Multi-AZ DB instance?','2 (elsődleges + standby).',docs.rds],
    ['Hány AZ-t használ egy RDS Multi-AZ DB cluster?','3 (1 writer + 2 reader).','https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/multi-az-db-clusters-concepts.html'],
    ['Hány AZ-ban tárolja az S3 Standard az objektumokat?','Legalább 3 AZ-ban.',docs.s3durability],
    ['Mekkora az S3 Standard tervezett tartóssága?','99,999999999% (11 kilences).',docs.s3durability],
    ['Mekkora az S3 Standard tervezett rendelkezésre állása?','99,99%.',docs.s3durability],
    ['Mekkora lehet egy S3-objektum?','Legfeljebb 48,8 TiB (multipart feltöltéssel).',docs.s3],
    ['Mekkora lehet egy S3-feltöltés egyetlen PUT kéréssel?','Legfeljebb 5 GB.',docs.s3upload],
    ['Hány részből állhat egy S3 multipart upload?','Legfeljebb 10 000.',docs.s3],
    ['Mekkora lehet egy S3 multipart rész?','5 MiB–5 GiB; az utolsó rész lehet kisebb.',docs.s3],
    ['Mennyi a gp3 EBS-kötet alap IOPS-értéke?','3 000 IOPS. (Növelhető.)',docs.gp3],
    ['Mennyi a gp3 EBS-kötet alap áteresztőképessége?','125 MiB/s. (Növelhető.)',docs.gp3]
  ]},
  {group:'Serverless és üzenetek',items:[
    ['Mennyi egy hagyományos Lambda-futás maximális időtartama?','15 perc; Lambda Managed Instances esetén bizonyos hívásoknál 90 perc.',docs.lambda],
    ['Mennyi egy Lambda-függvény maximális memóriája?','10 240 MB.',docs.lambda],
    ['Hány Lambda layer csatolható egy függvényhez?','Legfeljebb 5.',docs.lambda],
    ['Mekkora egy SQS-üzenet legnagyobb mérete?','1 MiB.',docs.sqs],
    ['Mennyi az SQS-üzenetek alapértelmezett megőrzése?','4 nap; legfeljebb 14 napra állítható.',docs.sqs],
    ['Mennyi az SQS visibility timeout alapértéke és maximuma?','30 másodperc; legfeljebb 12 óra.',docs.sqs],
    ['Hány üzenet küldhető egy SQS batch kérésben?','Legfeljebb 10.',docs.sqs],
    ['Mennyi az SQS long polling maximuma?','20 másodperc.','https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-configure-queue-parameters.html']
  ]}
];
